/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  Element,
  ObjectType,
  isContainerType,
  ListType,
  MapType,
  InstanceElement,
  CORE_ANNOTATIONS,
  Values,
  isAdditionOrModificationChange,
  isInstanceChange,
  getChangeData,
  Change,
  isMapType,
  isListType,
  isInstanceElement,
  createRefToElmWithValue,
  getDeepInnerType,
  isObjectType,
  getField,
  isFieldChange,
  ReferenceExpression,
  TypeElement,
  ElemID,
  isObjectTypeChange,
  BuiltinTypes,
} from '@salto-io/adapter-api'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { naclCase, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'

import { FilterCreator } from '../filter'
import {
  API_NAME_SEPARATOR,
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  BUSINESS_HOURS_METADATA_TYPE,
  EMAIL_TEMPLATE_METADATA_TYPE,
  LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
  SHARING_RULES_TYPE,
  INSTANCE_FULL_NAME_FIELD,
} from '../constants'
import { metadataType } from '../transformers/transformer'
import { GLOBAL_VALUE_SET } from './global_value_sets'
import { STANDARD_VALUE_SET } from './standard_value_sets'

const { awu } = collections.asynciterable
const { isDefined } = lowerdashValues

const { makeArray } = collections.array
const log = logger(module)

type MapKeyFunc = (value: Values) => string
type MapDef = {
  // the name of the field whose value should be used to generate the map key
  key: string
  // when true, the map will have two levels instead of one
  nested?: boolean
  // use lists as map values, in order to allow multiple values under the same map key
  mapToList?: boolean
  // with which mapper should we parse the key
  mapper?: (string: string) => string[]
  // keep a separate list of references for each value to preserve the order
  // Note: this is only supported for one-level maps (nested maps are not supported)
  maintainOrder?: boolean
}

const ORDERED_MAP_VALUES_FIELD = 'values'
const ORDERED_MAP_ORDER_FIELD = 'order'

const createOrderedMapType = <T extends TypeElement>(innerType: T): ObjectType =>
  new ObjectType({
    elemID: new ElemID('salesforce', `OrderedMap<${innerType.elemID.name}>`),
    fields: {
      [ORDERED_MAP_VALUES_FIELD]: {
        refType: new MapType(innerType),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      [ORDERED_MAP_ORDER_FIELD]: {
        refType: new ListType(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

/**
 * Convert a string value into the map index keys.
 * Note: Reference expressions are not supported yet (the resolved value is not populated in fetch)
 * so this filter has to run before any filter adding references on the objects with the specified
 * metadata types (e.g Profile).
 */
export const defaultMapper = (val: string): string[] => val.split(API_NAME_SEPARATOR).map(v => naclCase(v))

/**
 * Convert a string value of a file path to the map index key.
 * In this case, we want to use the last part of the path as the key, and it's
 * unknown how many levels the path has. If there are less than two levels, take only the last.
 */
const filePathMapper = (val: string): string[] => {
  const splitPath = val.split('/')
  if (splitPath.length >= 3) {
    return [naclCase(splitPath.slice(2).join('/'))]
  }
  log.warn(`Path ${val} has less than two levels, using only the last part as the key`)
  return [naclCase(_.last(splitPath))]
}

const BUSINESS_HOURS_MAP_FIELD_DEF: Record<string, MapDef> = {
  // One-level maps
  businessHours: { key: 'name' },
}

export const PERMISSIONS_SET_MAP_FIELD_DEF: Record<string, MapDef> = {
  // One-level maps
  applicationVisibilities: { key: 'application' },
  classAccesses: { key: 'apexClass' },
  customMetadataTypeAccesses: { key: 'name' },
  customPermissions: { key: 'name' },
  customSettingAccesses: { key: 'name' },
  externalDataSourceAccesses: { key: 'externalDataSource' },
  flowAccesses: { key: 'flow' },
  objectPermissions: { key: 'object' },
  pageAccesses: { key: 'apexPage' },
  userPermissions: { key: 'name' },

  // Two-level maps
  fieldPermissions: { key: 'field', nested: true },
  fieldLevelSecurities: { key: 'field', nested: true }, // only available in API version 22.0 and earlier
  recordTypeVisibilities: { key: 'recordType', nested: true },
}

export const PROFILE_MAP_FIELD_DEF: Record<string, MapDef> = {
  // sharing map field def with permission set
  ...PERMISSIONS_SET_MAP_FIELD_DEF,

  // Non-unique maps (multiple values can have the same key)
  categoryGroupVisibilities: { key: 'dataCategoryGroup', mapToList: true },
  layoutAssignments: { key: 'layout', mapToList: true },
}

const EMAIL_TEMPLATE_MAP_FIELD_DEF: Record<string, MapDef> = {
  // One-level maps
  attachments: { key: 'name' },
}

const LIGHTNING_COMPONENT_BUNDLE_MAP: Record<string, MapDef> = {
  'lwcResources.lwcResource': {
    key: 'filePath',
    mapper: item => filePathMapper(item),
  },
}

const SHARING_RULES_MAP_FIELD_DEF: Record<string, MapDef> = {
  sharingCriteriaRules: { key: INSTANCE_FULL_NAME_FIELD },
  sharingOwnerRules: { key: INSTANCE_FULL_NAME_FIELD },
}

const PICKLIST_MAP_FIELD_DEF: MapDef = {
  key: 'fullName',
  maintainOrder: true,
  mapper: (val: string): string[] => [naclCase(val)],
}

const GLOBAL_VALUE_SET_MAP_FIELD_DEF: Record<string, MapDef> = {
  customValue: PICKLIST_MAP_FIELD_DEF,
}

const STANDARD_VALUE_SET_MAP_FIELD_DEF: Record<string, MapDef> = {
  standardValue: PICKLIST_MAP_FIELD_DEF,
}

export const metadataTypeToFieldToMapDef: Record<string, Record<string, MapDef>> = {
  [BUSINESS_HOURS_METADATA_TYPE]: BUSINESS_HOURS_MAP_FIELD_DEF,
  [EMAIL_TEMPLATE_METADATA_TYPE]: EMAIL_TEMPLATE_MAP_FIELD_DEF,
  [PROFILE_METADATA_TYPE]: PROFILE_MAP_FIELD_DEF,
  [PERMISSION_SET_METADATA_TYPE]: PERMISSIONS_SET_MAP_FIELD_DEF,
  [MUTING_PERMISSION_SET_METADATA_TYPE]: PERMISSIONS_SET_MAP_FIELD_DEF,
  [LIGHTNING_COMPONENT_BUNDLE_METADATA_TYPE]: LIGHTNING_COMPONENT_BUNDLE_MAP,
  [SHARING_RULES_TYPE]: SHARING_RULES_MAP_FIELD_DEF,
  [GLOBAL_VALUE_SET]: GLOBAL_VALUE_SET_MAP_FIELD_DEF,
  [STANDARD_VALUE_SET]: STANDARD_VALUE_SET_MAP_FIELD_DEF,
}

export const annotationDefsByType: Record<string, Record<string, MapDef>> = {
  Picklist: {
    valueSet: PICKLIST_MAP_FIELD_DEF,
  },
  MultiselectPicklist: {
    valueSet: PICKLIST_MAP_FIELD_DEF,
  },
}

export const getElementValueOrAnnotations = (element: Element): Values =>
  isInstanceElement(element) ? element.value : element.annotations

/**
 * Convert the specified element fields into maps.
 * Choose between unique maps and lists based on each field's conversion definition. If a field
 * should use a unique map but fails due to conflicts, convert it to a list map, and include it
 * in the returned list so that it can be converted across the board.
 *
 * @param element             The instance to modify
 * @param mapFieldDef         The definitions of the fields to covert
 * @returns                   The list of fields that were converted to non-unique due to duplicates
 */
const convertArraysToMaps = (element: Element, mapFieldDef: Record<string, MapDef>): string[] => {
  // fields that were intended to be unique, but have multiple values under to the same map key
  const nonUniqueMapFields: string[] = []

  const convertField = (values: Values[], keyFunc: MapKeyFunc, useList: boolean, fieldName: string): Values => {
    if (!useList) {
      const res = _.keyBy(values, item => keyFunc(item))
      if (Object.keys(res).length === values.length) {
        return res
      }
      nonUniqueMapFields.push(fieldName)
    }
    return _.groupBy(values, item => keyFunc(item))
  }

  Object.entries(mapFieldDef)
    .filter(([fieldName]) => _.get(getElementValueOrAnnotations(element), fieldName) !== undefined)
    .forEach(([fieldName, mapDef]) => {
      const mapper = mapDef.mapper ?? defaultMapper
      const elementValues = getElementValueOrAnnotations(element)
      if (mapDef.nested) {
        const firstLevelGroups = _.groupBy(
          makeArray(_.get(elementValues, fieldName)),
          item => mapper(item[mapDef.key])[0],
        )
        _.set(
          elementValues,
          fieldName,
          _.mapValues(firstLevelGroups, firstLevelValues =>
            convertField(firstLevelValues, item => mapper(item[mapDef.key])[1], !!mapDef.mapToList, fieldName),
          ),
        )
      } else if (mapDef.maintainOrder) {
        const originalFieldValue = makeArray(_.get(elementValues, fieldName))
        _.set(elementValues, fieldName, {
          [ORDERED_MAP_VALUES_FIELD]: convertField(
            originalFieldValue,
            item => mapper(item[mapDef.key])[0],
            !!mapDef.mapToList,
            fieldName,
          ),
          [ORDERED_MAP_ORDER_FIELD]: originalFieldValue
            .map(item => mapper(item[mapDef.key])[0])
            .map(
              name => new ReferenceExpression(element.elemID.createNestedID(fieldName, ORDERED_MAP_VALUES_FIELD, name)),
            ),
        })
      } else {
        _.set(
          elementValues,
          fieldName,
          convertField(
            makeArray(_.get(elementValues, fieldName)),
            item => mapper(item[mapDef.key])[0],
            !!mapDef.mapToList,
            fieldName,
          ),
        )
      }
    })
  return nonUniqueMapFields
}

/**
 * Make sure all values in the specified non-unique fields are arrays.
 *
 * @param element             The element to update
 * @param nonUniqueMapFields  The list of fields to convert to arrays
 * @param mapFieldDef         The original field mapping definition
 */
const convertValuesToMapArrays = (
  element: Element,
  nonUniqueMapFields: string[],
  mapFieldDef: Record<string, MapDef>,
): void => {
  nonUniqueMapFields.forEach(fieldName => {
    if (mapFieldDef[fieldName]?.nested) {
      _.set(
        getElementValueOrAnnotations(element),
        fieldName,
        _.mapValues(_.get(getElementValueOrAnnotations(element), fieldName), val => _.mapValues(val, makeArray)),
      )
    } else {
      _.set(
        getElementValueOrAnnotations(element),
        fieldName,
        _.mapValues(_.get(getElementValueOrAnnotations(element), fieldName), makeArray),
      )
    }
  })
}

/**
 * Update the instance object type's fields to use maps.
 *
 * @param instanceType          The instance to update
 * @param nonUniqueMapFields  The list of fields to convert to arrays
 * @param instanceMapFieldDef  The original field mapping definition
 */
const updateFieldTypes = async (
  instanceType: ObjectType | TypeElement,
  nonUniqueMapFields: string[],
  instanceMapFieldDef: Record<string, MapDef>,
): Promise<void> => {
  Object.entries(instanceMapFieldDef).forEach(async ([fieldName, mapDef]) => {
    const field = await getField(instanceType, fieldName.split('.'))
    if (isDefined(field)) {
      const fieldType = await field.getType()
      // navigate to the right field type
      if (!isMapType(fieldType)) {
        let innerType = isContainerType(fieldType) ? await fieldType.getInnerType() : fieldType
        if (mapDef.mapToList || nonUniqueMapFields.includes(fieldName)) {
          innerType = new ListType(innerType)
        }
        if (mapDef.nested) {
          field.refType = createRefToElmWithValue(new MapType(new MapType(innerType)))
        } else if (mapDef.maintainOrder) {
          field.refType = createRefToElmWithValue(createOrderedMapType(innerType))
        } else {
          field.refType = createRefToElmWithValue(new MapType(innerType))
        }

        // make the key field required
        const deepInnerType = await getDeepInnerType(innerType)
        if (isObjectType(deepInnerType)) {
          const keyFieldType = deepInnerType.fields[mapDef.key]
          if (!keyFieldType) {
            log.error('could not find key field %s for field %s', mapDef.key, field.elemID.getFullName())
            return
          }
          keyFieldType.annotations[CORE_ANNOTATIONS.REQUIRED] = true
        }
      }
    }
  })
}

const updateAnnotationRefTypes = async (
  typeElement: TypeElement,
  nonUniqueMapFields: string[],
  mapFieldDef: Record<string, MapDef>,
): Promise<void> => {
  Object.entries(mapFieldDef).forEach(async ([fieldName, mapDef]) => {
    const fieldType = _.get(typeElement.annotationRefTypes, fieldName).type
    // navigate to the right field type
    if (isDefined(fieldType) && !isMapType(fieldType)) {
      let innerType = isContainerType(fieldType) ? await fieldType.getInnerType() : fieldType
      if (mapDef.mapToList || nonUniqueMapFields.includes(fieldName)) {
        innerType = new ListType(innerType)
      }
      if (mapDef.nested) {
        typeElement.annotationRefTypes[fieldName] = createRefToElmWithValue(new MapType(new MapType(innerType)))
      } else if (mapDef.maintainOrder) {
        typeElement.annotationRefTypes[fieldName] = createRefToElmWithValue(createOrderedMapType(innerType))
      } else {
        typeElement.annotationRefTypes[fieldName] = createRefToElmWithValue(new MapType(innerType))
      }

      // make the key field required
      const deepInnerType = await getDeepInnerType(innerType)
      if (isObjectType(deepInnerType)) {
        const keyFieldType = deepInnerType.fields[mapDef.key]
        if (!keyFieldType) {
          log.error('could not find key field %s for type %s', mapDef.key, fieldType.elemID.getFullName())
          return
        }
        keyFieldType.annotations[CORE_ANNOTATIONS.REQUIRED] = true
      }
    }
  })
}

const convertElementFieldsToMaps = async (
  elementsToConvert: Element[],
  mapFieldDef: Record<string, MapDef>,
): Promise<string[]> => {
  const nonUniqueMapFields = _.uniq(
    elementsToConvert.flatMap(element => {
      const nonUniqueFields = convertArraysToMaps(element, mapFieldDef)
      if (nonUniqueFields.length > 0) {
        log.info(`Instance ${element.elemID.getFullName()} has non-unique map fields: ${nonUniqueFields}`)
      }
      return nonUniqueFields
    }),
  )
  if (nonUniqueMapFields.length > 0) {
    elementsToConvert.forEach(element => {
      convertValuesToMapArrays(element, nonUniqueMapFields, mapFieldDef)
    })
  }
  return nonUniqueMapFields
}

/**
 * Convert element field values from maps back to arrays before deploy.
 *
 * @param changes          The changes to deploy
 * @param mapFieldDef      The definitions of the fields to convert
 * @param elementType      The type of the elements to convert
 */
const convertFieldsBackToLists = async (
  changes: ReadonlyArray<Change<Element>>,
  mapFieldDef: Record<string, MapDef>,
  elementType: string,
): Promise<void> => {
  const toVals = (values: Values): Values[] => Object.values(values).flat()

  const backToArrays = (baseElement: Element): Element => {
    const elementsToConvert = []
    if (isObjectType(baseElement)) {
      Object.values(baseElement.fields)
        .filter(field => field.refType.elemID.typeName === elementType)
        .forEach(field => elementsToConvert.push(field))
    } else {
      elementsToConvert.push(baseElement)
    }
    elementsToConvert.forEach(element => {
      Object.keys(mapFieldDef)
        .filter(fieldName => getElementValueOrAnnotations(element)[fieldName] !== undefined)
        .forEach(fieldName => {
          const elementValues = getElementValueOrAnnotations(element)
          if (Array.isArray(_.get(elementValues, fieldName))) {
            // should not happen
            return
          }

          if (mapFieldDef[fieldName].nested) {
            // first convert the inner levels to arrays, then merge into one array
            _.set(elementValues, fieldName, _.mapValues(elementValues[fieldName], toVals))
          }
          if (mapFieldDef[fieldName].maintainOrder) {
            // OrderedMap keeps the order in a list of references, so we just need to override the top-level OrderedMap
            // with this list.
            _.set(elementValues, fieldName, elementValues[fieldName][ORDERED_MAP_ORDER_FIELD])
          } else {
            _.set(elementValues, fieldName, toVals(elementValues[fieldName]))
          }
        })
    })
    return baseElement
  }

  await awu(changes).forEach(change => applyFunctionToChangeData(change, backToArrays))
}

/**
 * Convert an element's field values from arrays back to maps after deploy.
 *
 * @param changes          The changes to deploy
 * @param mapFieldDef      The definitions of the fields to covert
 */
const convertFieldsBackToMaps = (
  changes: ReadonlyArray<Change<Element>>,
  mapFieldDef: Record<string, MapDef>,
): void => {
  changes.forEach(change =>
    applyFunctionToChangeData(change, element => {
      convertArraysToMaps(element, mapFieldDef)
      return element
    }),
  )
}

/**
 * Convert fields from maps back to lists pre-deploy.
 *
 * @param instanceType          The type to update
 * @param instanceMapFieldDef  The field mapping definition
 */
const convertFieldTypesBackToLists = async (
  instanceType: ObjectType,
  instanceMapFieldDef: Record<string, MapDef>,
): Promise<void> => {
  Object.entries(instanceMapFieldDef).forEach(async ([fieldName]) => {
    const field = await getField(instanceType, fieldName.split('.'))
    if (isDefined(field)) {
      const fieldType = await field.getType()
      if (isMapType(fieldType)) {
        field.refType = createRefToElmWithValue(await fieldType.getInnerType())
      }
      // for nested fields (not using while to avoid edge cases)
      const newFieldType = await field.getType()
      if (isMapType(newFieldType)) {
        field.refType = createRefToElmWithValue(await newFieldType.getInnerType())
      }
    }
  })
}

export const getInstanceChanges = (
  changes: ReadonlyArray<Change>,
  targetMetadataType: string,
): Promise<ReadonlyArray<Change<InstanceElement>>> =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(async change => (await metadataType(getChangeData(change))) === targetMetadataType)
    .toArray()

/** Get all changes that contain a specific field type.
 *
 * @return All changes that are either field changes of the specified type or object changes that contain fields of the
 * specified type
 */
export const getChangesWithFieldType = (changes: ReadonlyArray<Change>, fieldType: string): Change[] => {
  const fieldChanges: Change[] = changes
    .filter(isFieldChange)
    .filter(async change => getChangeData(change).getTypeSync().elemID.typeName === fieldType)

  const objectTypeChanges = changes
    .filter(isObjectTypeChange)
    .filter(change =>
      Object.values(getChangeData(change).fields).some(field => field.refType.elemID.typeName === fieldType),
    )

  return fieldChanges.concat(objectTypeChanges)
}

export const findInstancesToConvert = (elements: Element[], targetMetadataType: string): Promise<InstanceElement[]> => {
  const instances = elements.filter(isInstanceElement)
  return awu(instances)
    .filter(async e => (await metadataType(e)) === targetMetadataType)
    .toArray()
}

export const findTypeToConvert = async (
  elements: Element[],
  targetMetadataType: string,
): Promise<ObjectType | undefined> => {
  const types = elements.filter(isObjectType)
  return (
    await awu(types)
      .filter(async e => (await metadataType(e)) === targetMetadataType)
      .toArray()
  )[0]
}

/**
 * Convert certain elements' fields into maps, so that they are easier to view,
 * could be referenced, and can be split across multiple files.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'convertMapsFilter',
  onFetch: async (elements: Element[]) => {
    await awu(Object.keys(metadataTypeToFieldToMapDef)).forEach(async targetMetadataType => {
      if (
        (targetMetadataType === SHARING_RULES_TYPE && !config.fetchProfile.isFeatureEnabled('sharingRulesMaps')) ||
        ([GLOBAL_VALUE_SET, STANDARD_VALUE_SET].includes(targetMetadataType) &&
          !config.fetchProfile.isFeatureEnabled('picklistsAsMaps'))
      ) {
        return
      }
      const instancesToConvert = await findInstancesToConvert(elements, targetMetadataType)
      const typeToConvert = await findTypeToConvert(elements, targetMetadataType)
      const mapFieldDef = metadataTypeToFieldToMapDef[targetMetadataType]
      if (isDefined(typeToConvert)) {
        if (instancesToConvert.length === 0) {
          await updateFieldTypes(typeToConvert, [], mapFieldDef)
        } else {
          const nonUniqueMapFields = await convertElementFieldsToMaps(instancesToConvert, mapFieldDef)
          await updateFieldTypes(typeToConvert, nonUniqueMapFields, mapFieldDef)
        }
      }
    })

    const fields = elements.filter(isObjectType).flatMap(obj => Object.values(obj.fields))
    await awu(Object.entries(annotationDefsByType)).forEach(async ([fieldType, annotationToMapDef]) => {
      if (
        ['Picklist', 'MultiselectPicklist'].includes(fieldType) &&
        !config.fetchProfile.isFeatureEnabled('picklistsAsMaps')
      ) {
        return
      }
      const fieldsToConvert = fields.filter(field => field.refType.elemID.typeName === fieldType)
      if (fieldsToConvert.length === 0) {
        return
      }
      const nonUniqueMapFields = await convertElementFieldsToMaps(fieldsToConvert, annotationToMapDef)
      await updateAnnotationRefTypes(await fieldsToConvert[0].getType(), nonUniqueMapFields, annotationToMapDef)
    })
  },

  preDeploy: async changes => {
    await awu(Object.keys(metadataTypeToFieldToMapDef)).forEach(async targetMetadataType => {
      const instanceChanges = await getInstanceChanges(changes, targetMetadataType)
      if (instanceChanges.length === 0) {
        return
      }
      const mapFieldDef = metadataTypeToFieldToMapDef[targetMetadataType]
      // since transformElement and salesforce do not require list fields to be defined as lists,
      // we only mark fields as lists of their map inner value is a list,
      // so that we can convert the object back correctly in onDeploy
      await convertFieldsBackToLists(instanceChanges, mapFieldDef, targetMetadataType)

      const instanceType = await getChangeData(instanceChanges[0]).getType()
      await convertFieldTypesBackToLists(instanceType, mapFieldDef)
    })

    await awu(Object.keys(annotationDefsByType)).forEach(async fieldType => {
      const elementsWithFieldType = getChangesWithFieldType(changes, fieldType)
      if (elementsWithFieldType.length === 0) {
        return
      }
      const mapFieldDef = annotationDefsByType[fieldType]
      await convertFieldsBackToLists(elementsWithFieldType, mapFieldDef, fieldType)
    })
  },

  onDeploy: async changes => {
    await awu(Object.keys(metadataTypeToFieldToMapDef)).forEach(async targetMetadataType => {
      const instanceChanges = await getInstanceChanges(changes, targetMetadataType)
      if (instanceChanges.length === 0) {
        return
      }

      const mapFieldDef = metadataTypeToFieldToMapDef[targetMetadataType]
      convertFieldsBackToMaps(instanceChanges, mapFieldDef)

      const instanceType = await getChangeData(instanceChanges[0]).getType()
      // after preDeploy, the fields with lists are exactly the ones that should be converted
      // back to lists
      const nonUniqueMapFields = await awu(Object.keys(instanceType.fields))
        .filter(async fieldName => isListType(await instanceType.fields[fieldName].getType()))
        .toArray()
      await updateFieldTypes(instanceType, nonUniqueMapFields, mapFieldDef)
    })

    await awu(Object.keys(annotationDefsByType)).forEach(async fieldType => {
      const fieldsChanges = getChangesWithFieldType(changes, fieldType)
      if (fieldsChanges.length === 0) {
        return
      }
      const mapFieldDef = annotationDefsByType[fieldType]
      convertFieldsBackToMaps(fieldsChanges, mapFieldDef)
    })
  },
})

export default filter
