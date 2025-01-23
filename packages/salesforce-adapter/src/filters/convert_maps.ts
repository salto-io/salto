/*
 * Copyright 2025 Salto Labs Ltd.
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
  isPrimitiveType,
  isReferenceExpression,
  isElement,
} from '@salto-io/adapter-api'
import { collections, values as lowerdashValues } from '@salto-io/lowerdash'
import { naclCase, applyFunctionToChangeData, inspectValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'

import { FilterCreator } from '../filter'
import {
  API_NAME_SEPARATOR,
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  BUSINESS_HOURS_METADATA_TYPE,
  EMAIL_TEMPLATE_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
  SHARING_RULES_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  SALESFORCE,
  TYPES_PATH,
  SUBTYPES_PATH,
} from '../constants'
import { metadataType } from '../transformers/transformer'
import { GLOBAL_VALUE_SET } from './global_value_sets'
import { STANDARD_VALUE_SET } from './standard_value_sets'
import { FetchProfile } from '../types'
import { apiNameSync, isOrderedMapTypeOrRefType, metadataTypeSync } from './utils'

const { awu } = collections.asynciterable
const { isDefined } = lowerdashValues

const { makeArray } = collections.array
const log = logger(module)

type ReferenceExpressionToElement = ReferenceExpression & {
  value: Element
}

const isResolvedReferenceExpressionToElement = (val: unknown): val is ReferenceExpressionToElement =>
  isReferenceExpression(val) && isElement(val.value)

type MapKeyFunc = (value: Values) => string
type MapperInput = string | ReferenceExpressionToElement
type MapperFunc = (val: MapperInput) => string[]
type MapDef = {
  // the name of the field whose value should be used to generate the map key
  key: string
  // when true, the map will have two levels instead of one
  nested?: boolean
  // use lists as map values, in order to allow multiple values under the same map key
  mapToList?: boolean
  // with which mapper should we parse the key
  mapper?: MapperFunc
  // keep a separate list of references for each value to preserve the order
  // Note: this is only supported for one-level maps (nested maps are not supported)
  maintainOrder?: boolean
}

export const ORDERED_MAP_VALUES_FIELD = 'values'
export const ORDERED_MAP_ORDER_FIELD = 'order'

export const createOrderedMapType = <T extends TypeElement>(innerType: T): ObjectType =>
  new ObjectType({
    elemID: new ElemID('salesforce', `OrderedMapOf${innerType.elemID.name}`),
    path: [SALESFORCE, TYPES_PATH, SUBTYPES_PATH, `OrderedMapOf${innerType.elemID.name}`],
    fields: {
      [ORDERED_MAP_VALUES_FIELD]: {
        refType: new MapType(innerType),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      [ORDERED_MAP_ORDER_FIELD]: {
        refType: new ListType(innerType),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
    },
  })

const stringifyMapperInput = (mapperInput: MapperInput): string =>
  _.isString(mapperInput) ? mapperInput : apiNameSync(mapperInput.value) ?? ''

const isMapperInput = (val: unknown): val is MapperInput =>
  _.isString(val) || isResolvedReferenceExpressionToElement(val)

export const defaultMapper: MapperFunc = val =>
  stringifyMapperInput(val)
    .split(API_NAME_SEPARATOR)
    .map(v => naclCase(v))

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

const SHARING_RULES_MAP_FIELD_DEF: Record<string, MapDef> = {
  sharingCriteriaRules: { key: INSTANCE_FULL_NAME_FIELD },
  sharingOwnerRules: { key: INSTANCE_FULL_NAME_FIELD },
}

const PICKLIST_MAP_FIELD_DEF: MapDef = {
  key: 'fullName',
  maintainOrder: true,
  mapper: val => [naclCase(stringifyMapperInput(val))],
}

const GLOBAL_VALUE_SET_MAP_FIELD_DEF: Record<string, MapDef> = {
  customValue: PICKLIST_MAP_FIELD_DEF,
}

const STANDARD_VALUE_SET_MAP_FIELD_DEF: Record<string, MapDef> = {
  standardValue: PICKLIST_MAP_FIELD_DEF,
}

export const getMetadataTypeToFieldToMapDef: (
  fetchProfile: FetchProfile,
) => Record<string, Record<string, MapDef>> = fetchProfile => ({
  [BUSINESS_HOURS_METADATA_TYPE]: BUSINESS_HOURS_MAP_FIELD_DEF,
  [EMAIL_TEMPLATE_METADATA_TYPE]: EMAIL_TEMPLATE_MAP_FIELD_DEF,
  [PROFILE_METADATA_TYPE]: fetchProfile.isFeatureEnabled('supportProfileTabVisibilities')
    ? { ...PROFILE_MAP_FIELD_DEF, ...{ tabVisibilities: { key: 'tab' } } }
    : PROFILE_MAP_FIELD_DEF,
  [PERMISSION_SET_METADATA_TYPE]: PERMISSIONS_SET_MAP_FIELD_DEF,
  [MUTING_PERMISSION_SET_METADATA_TYPE]: PERMISSIONS_SET_MAP_FIELD_DEF,
  [SHARING_RULES_TYPE]: SHARING_RULES_MAP_FIELD_DEF,
  ...(fetchProfile.isFeatureEnabled('picklistsAsMaps')
    ? {
        [GLOBAL_VALUE_SET]: GLOBAL_VALUE_SET_MAP_FIELD_DEF,
        [STANDARD_VALUE_SET]: STANDARD_VALUE_SET_MAP_FIELD_DEF,
      }
    : {}),
})

export const getAnnotationDefsByType: (
  fetchProfile: FetchProfile,
) => Record<string, Record<string, MapDef>> = fetchProfile => ({
  ...(fetchProfile.isFeatureEnabled('picklistsAsMaps')
    ? {
        Picklist: {
          valueSet: PICKLIST_MAP_FIELD_DEF,
        },
        MultiselectPicklist: {
          valueSet: PICKLIST_MAP_FIELD_DEF,
        },
      }
    : {}),
})

export const getElementValueOrAnnotations = (element: Element): Values =>
  isInstanceElement(element) ? element.value : element.annotations

/**
 * Convert the specified element fields into maps.
 * Choose between unique maps and lists based on each field's conversion definition. If a field
 * should use a unique map but fails due to conflicts, convert it to a list map, and include it
 * in the returned list so that it can be converted across the board.
 *
 * @param baseElement         The instance to modify
 * @param mapFieldDef         The definitions of the fields to covert
 * @param elementType         The type of the elements to convert
 * @returns                   The list of fields that were converted to non-unique due to duplicates
 */
const convertArraysToMaps = (
  baseElement: Element,
  mapFieldDef: Record<string, MapDef>,
  elementType: string,
): string[] => {
  // fields that were intended to be unique, but have multiple values under to the same map key
  const nonUniqueMapFields: string[] = []

  const convertField = (values: Values[], keyFunc: MapKeyFunc, useList: boolean, fieldName: string): Values => {
    if (!useList) {
      const res = _.keyBy(values, keyFunc)
      if (Object.keys(res).length === values.length) {
        return res
      }
      nonUniqueMapFields.push(fieldName)
    }
    return _.groupBy(values, keyFunc)
  }

  const elementsToConvert = []
  if (isObjectType(baseElement)) {
    Object.values(baseElement.fields)
      .filter(field => field.refType.elemID.typeName === elementType)
      .forEach(field => elementsToConvert.push(field))
  } else {
    elementsToConvert.push(baseElement)
  }

  elementsToConvert.forEach(element => {
    Object.entries(mapFieldDef)
      .filter(([fieldName]) => _.get(getElementValueOrAnnotations(element), fieldName) !== undefined)
      .forEach(([fieldName, mapDef]) => {
        const mapper = mapDef.mapper ?? defaultMapper
        const isConvertibleValue = (item: Values): boolean => {
          const result = _.isPlainObject(item) && isMapperInput(item[mapDef.key])
          if (!result) {
            log.error(
              'Received non convertible value %s for Element %s',
              inspectValue(item[mapDef.key]),
              element.elemID.getFullName(),
            )
          }
          return result
        }
        const elementValues = getElementValueOrAnnotations(element)
        if (mapDef.nested) {
          const firstLevelGroups = _.groupBy(
            makeArray(_.get(elementValues, fieldName)).filter(isConvertibleValue),
            item => mapper(item[mapDef.key])[0],
          )
          _.set(
            elementValues,
            fieldName,
            _.mapValues(firstLevelGroups, firstLevelValues =>
              convertField(
                firstLevelValues.filter(isConvertibleValue),
                item => mapper(item[mapDef.key])[1],
                !!mapDef.mapToList,
                fieldName,
              ),
            ),
          )
        } else if (mapDef.maintainOrder) {
          const originalFieldValue = makeArray(_.get(elementValues, fieldName))
          const convertedValues = convertField(
            originalFieldValue.filter(isConvertibleValue),
            item => mapper(item[mapDef.key])[0],
            !!mapDef.mapToList,
            fieldName,
          )
          _.set(elementValues, fieldName, {
            [ORDERED_MAP_VALUES_FIELD]: convertedValues,
            [ORDERED_MAP_ORDER_FIELD]: originalFieldValue
              .filter(isConvertibleValue)
              .map(item => mapper(item[mapDef.key])[0])
              .map(
                name =>
                  new ReferenceExpression(
                    element.elemID.createNestedID(fieldName, ORDERED_MAP_VALUES_FIELD, name),
                    convertedValues[name],
                  ),
              ),
          })
        } else {
          _.set(
            elementValues,
            fieldName,
            convertField(
              makeArray(_.get(elementValues, fieldName)).filter(isConvertibleValue),
              item => mapper(item[mapDef.key])[0],
              !!mapDef.mapToList,
              fieldName,
            ),
          )
        }
      })
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

const getOrderedMapInnerType = (orderedMap: ObjectType): TypeElement | undefined => {
  const orderedMapValuesField = orderedMap.fields[ORDERED_MAP_VALUES_FIELD]
  if (orderedMapValuesField === undefined) {
    return undefined
  }
  const orderedMapValuesFieldType = orderedMapValuesField.getTypeSync()
  return isMapType(orderedMapValuesFieldType) ? orderedMapValuesFieldType.getInnerTypeSync() : undefined
}

const getInnerType = (typeElement: TypeElement): TypeElement => {
  if (isContainerType(typeElement)) {
    return typeElement.getInnerTypeSync()
  }
  if (isOrderedMapTypeOrRefType(typeElement)) {
    const innerType = getOrderedMapInnerType(typeElement)
    if (innerType === undefined) {
      log.warn('Could not resolve inner type for OrderedMap %s', inspectValue(typeElement))
    } else {
      return innerType
    }
  }
  return typeElement
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
): Promise<ObjectType[]> =>
  awu(Object.entries(instanceMapFieldDef)).reduce<ObjectType[]>(async (acc, [fieldName, mapDef]) => {
    const field = await getField(instanceType, fieldName.split('.'))
    if (isDefined(field)) {
      const fieldType = await field.getType()
      // navigate to the right field type
      if (!isMapType(fieldType)) {
        let innerType = getInnerType(fieldType)
        if (mapDef.mapToList || nonUniqueMapFields.includes(fieldName)) {
          innerType = new ListType(innerType)
        }
        if (mapDef.nested) {
          field.refType = createRefToElmWithValue(new MapType(new MapType(innerType)))
        } else if (mapDef.maintainOrder) {
          const orderedMapType = createOrderedMapType(innerType)
          acc.push(orderedMapType)
          field.refType = createRefToElmWithValue(orderedMapType)
        } else {
          field.refType = createRefToElmWithValue(new MapType(innerType))
        }

        // make the key field required
        const deepInnerType = await getDeepInnerType(innerType)
        if (isObjectType(deepInnerType)) {
          const keyFieldType = deepInnerType.fields[mapDef.key]
          if (!keyFieldType) {
            log.warn('could not find key field %s for field %s', mapDef.key, field.elemID.getFullName())
            return acc
          }
          keyFieldType.annotations[CORE_ANNOTATIONS.REQUIRED] = true
        }
      }
    }
    return acc
  }, [])

const updateAnnotationRefTypes = async (
  typeElement: TypeElement,
  nonUniqueMapFields: string[],
  mapFieldDef: Record<string, MapDef>,
): Promise<ObjectType[]> =>
  awu(Object.entries(mapFieldDef)).reduce<ObjectType[]>(async (acc, [fieldName, mapDef]) => {
    const fieldType = _.get(typeElement.annotationRefTypes, fieldName).type
    // navigate to the right field type
    if (isDefined(fieldType) && !isMapType(fieldType)) {
      let innerType = getInnerType(fieldType)
      if (mapDef.mapToList || nonUniqueMapFields.includes(fieldName)) {
        innerType = new ListType(innerType)
      }
      if (mapDef.nested) {
        typeElement.annotationRefTypes[fieldName] = createRefToElmWithValue(new MapType(new MapType(innerType)))
      } else if (mapDef.maintainOrder) {
        const orderedMapType = createOrderedMapType(innerType)
        acc.push(orderedMapType)
        typeElement.annotationRefTypes[fieldName] = createRefToElmWithValue(orderedMapType)
      } else {
        typeElement.annotationRefTypes[fieldName] = createRefToElmWithValue(new MapType(innerType))
      }

      // make the key field required
      const deepInnerType = await getDeepInnerType(innerType)
      if (isObjectType(deepInnerType)) {
        const keyFieldType = deepInnerType.fields[mapDef.key]
        if (!keyFieldType) {
          log.error('could not find key field %s for type %s', mapDef.key, fieldType.elemID.getFullName())
          return acc
        }
        keyFieldType.annotations[CORE_ANNOTATIONS.REQUIRED] = true
      }
    }
    return acc
  }, [])

const convertElementFieldsToMaps = async (
  elementsToConvert: Element[],
  mapFieldDef: Record<string, MapDef>,
  elementType: string,
): Promise<string[]> => {
  const nonUniqueMapFields = _.uniq(
    elementsToConvert.flatMap(element => {
      const nonUniqueFields = convertArraysToMaps(element, mapFieldDef, elementType)
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
  const toVals = (values: Values): Values[] =>
    Object.entries(values)
      .sort(([key1, _val1], [key2, _val2]) => key1.localeCompare(key2))
      .map(([_key, val]) => val)
      .flat()

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
        .filter(fieldPath => _.get(getElementValueOrAnnotations(element), fieldPath) !== undefined)
        .forEach(fieldPath => {
          const elementValues = getElementValueOrAnnotations(element)
          if (Array.isArray(_.get(elementValues, fieldPath))) {
            // should not happen
            return
          }

          if (mapFieldDef[fieldPath].nested) {
            // first convert the inner levels to arrays, then merge into one array
            _.set(elementValues, fieldPath, _.mapValues(elementValues[fieldPath], toVals))
          }
          if (mapFieldDef[fieldPath].maintainOrder) {
            // OrderedMap keeps the order in a list of references, so we just need to override the top-level OrderedMap
            // with this list.
            _.set(elementValues, fieldPath, elementValues[fieldPath][ORDERED_MAP_ORDER_FIELD])
          } else {
            _.set(elementValues, fieldPath, toVals(_.get(elementValues, fieldPath)))
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
 * @param elementType      The type of the elements to convert
 */
const convertFieldsBackToMaps = async (
  changes: ReadonlyArray<Change<Element>>,
  mapFieldDef: Record<string, MapDef>,
  elementType: string,
): Promise<void> => {
  await awu(changes).forEach(change =>
    applyFunctionToChangeData(change, element => {
      convertArraysToMaps(element, mapFieldDef, elementType)
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
  await awu(Object.entries(instanceMapFieldDef)).forEach(async ([fieldName]) => {
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
    .filter(change => getChangeData(change).getTypeSync().elemID.typeName === fieldType)

  const objectTypeChanges = changes
    .filter(isObjectTypeChange)
    .filter(change =>
      Object.values(getChangeData(change).fields).some(field => field.refType.elemID.typeName === fieldType),
    )

  return fieldChanges.concat(objectTypeChanges)
}

export const findInstancesToConvert = (elements: Element[], targetMetadataType: string): InstanceElement[] => {
  const instances = elements.filter(isInstanceElement)
  return instances.filter(e => metadataTypeSync(e) === targetMetadataType)
}

export const findTypeToConvert = (elements: Element[], targetMetadataType: string): ObjectType | undefined => {
  const types = elements.filter(isObjectType)
  return types.filter(e => metadataTypeSync(e) === targetMetadataType)[0]
}

/**
 * Convert certain elements' fields into maps, so that they are easier to view,
 * could be referenced, and can be split across multiple files.
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'convertMapsFilter',
  onFetch: async (elements: Element[]) => {
    const metadataTypeToFieldToMapDef = getMetadataTypeToFieldToMapDef(config.fetchProfile)
    const annotationDefsByType = getAnnotationDefsByType(config.fetchProfile)

    await awu(Object.keys(metadataTypeToFieldToMapDef))
      .flatMap<ObjectType>(async targetMetadataType => {
        const instancesToConvert = findInstancesToConvert(elements, targetMetadataType)
        const typeToConvert = findTypeToConvert(elements, targetMetadataType)
        const mapFieldDef = metadataTypeToFieldToMapDef[targetMetadataType]
        if (isDefined(typeToConvert)) {
          if (instancesToConvert.length === 0) {
            return updateFieldTypes(typeToConvert, [], mapFieldDef)
          }
          const nonUniqueMapFields = await convertElementFieldsToMaps(
            instancesToConvert,
            mapFieldDef,
            targetMetadataType,
          )
          return updateFieldTypes(typeToConvert, nonUniqueMapFields, mapFieldDef)
        }
        return []
      })
      .uniquify(newType => newType.elemID.getFullName())
      .forEach(newType => elements.push(newType))

    const fields = elements.filter(isObjectType).flatMap(obj => Object.values(obj.fields))
    const primitiveTypesByName = _.keyBy(elements.filter(isPrimitiveType), e => e.elemID.name)
    await awu(Object.entries(annotationDefsByType))
      .flatMap<ObjectType>(async ([fieldTypeName, annotationToMapDef]) => {
        const fieldType = primitiveTypesByName[fieldTypeName]
        if (fieldType === undefined) {
          log.warn('Cannot find PrimitiveType %s. Skipping converting Fields of this type to maps', fieldTypeName)
          return []
        }
        const fieldsToConvert = fields.filter(field => fieldType.elemID.isEqual(field.getTypeSync().elemID))
        if (fieldsToConvert.length === 0) {
          return []
        }
        const nonUniqueMapFields = await convertElementFieldsToMaps(fieldsToConvert, annotationToMapDef, fieldTypeName)
        return updateAnnotationRefTypes(fieldType, nonUniqueMapFields, annotationToMapDef)
      })
      .uniquify(newType => newType.elemID.getFullName())
      .forEach(newType => elements.push(newType))
  },

  preDeploy: async changes => {
    const metadataTypeToFieldToMapDef = getMetadataTypeToFieldToMapDef(config.fetchProfile)
    const annotationDefsByType = getAnnotationDefsByType(config.fetchProfile)

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
    const metadataTypeToFieldToMapDef = getMetadataTypeToFieldToMapDef(config.fetchProfile)
    const annotationDefsByType = getAnnotationDefsByType(config.fetchProfile)

    await awu(Object.keys(metadataTypeToFieldToMapDef)).forEach(async targetMetadataType => {
      const instanceChanges = await getInstanceChanges(changes, targetMetadataType)
      if (instanceChanges.length === 0) {
        return
      }

      const mapFieldDef = metadataTypeToFieldToMapDef[targetMetadataType]
      await convertFieldsBackToMaps(instanceChanges, mapFieldDef, targetMetadataType)

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
      await convertFieldsBackToMaps(fieldsChanges, mapFieldDef, fieldType)
    })
  },
})

export default filter
