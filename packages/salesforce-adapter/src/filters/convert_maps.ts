/*
*                      Copyright 2021 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

import _ from 'lodash'
import {
  Element, ObjectType, isContainerType, MapType, ListType, InstanceElement,
  Values, isAdditionOrModificationChange, isInstanceChange, getChangeElement, Change, isMapType,
  isListType, isInstanceElement,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { naclCase, applyFunctionToChangeData, createRefToElmWithValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'

import { FilterCreator } from '../filter'
import { API_NAME_SEPARATOR, PROFILE_METADATA_TYPE, BUSINESS_HOURS_METADATA_TYPE } from '../constants'
import { metadataType } from '../transformers/transformer'

const { awu } = collections.asynciterable

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
}

/**
 * Convert a string value into the map index keys.
 * Note: Reference expressions are not supported yet (the resolved value is not populated in fetch)
 * so this filter has to run before any filter adding references on the objects with the specified
 * metadata types (e.g Profile).
 */
export const defaultMapper = (val: string): string[] => (
  val.split(API_NAME_SEPARATOR).map(v => naclCase(v))
)

const BUSINESS_HOURS_MAP_FIELD_DEF: Record<string, MapDef> = {
  // One-level maps
  businessHours: { key: 'name' },
}

export const PROFILE_MAP_FIELD_DEF: Record<string, MapDef> = {
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

  // Non-unique maps (multiple values can have the same key)
  categoryGroupVisibilities: { key: 'dataCategoryGroup', mapToList: true },
  layoutAssignments: { key: 'layout', mapToList: true },

  // Two-level maps
  fieldPermissions: { key: 'field', nested: true },
  fieldLevelSecurities: { key: 'field', nested: true }, // only available in API version 22.0 and earlier
  recordTypeVisibilities: { key: 'recordType', nested: true },
}

export const metadataTypeToFieldToMapDef: Record<string, Record<string, MapDef>> = {
  [BUSINESS_HOURS_METADATA_TYPE]: BUSINESS_HOURS_MAP_FIELD_DEF,
  [PROFILE_METADATA_TYPE]: PROFILE_MAP_FIELD_DEF,
}

/**
 * Convert the specified instance fields into maps.
 * Choose between unique maps and lists based on each field's conversion definition. If a field
 * should use a unique map but fails due to conflicts, convert it to a list map, and include it
 * in the returned list so that it can be converted across the board.
 *
 * @param instance             The instance to modify
 * @param instanceMapFieldDef  The definitions of the fields to covert
 * @returns                   The list of fields that were converted to non-unique due to duplicates
 */
const convertArraysToMaps = (
  instance: InstanceElement,
  instanceMapFieldDef: Record<string, MapDef>,
): string[] => {
  // fields that were intended to be unique, but have multiple values under to the same map key
  const nonUniqueMapFields: string[] = []

  const convertField = (
    values: Values[],
    keyFunc: MapKeyFunc,
    useList: boolean,
    fieldName: string,
  ): Values => {
    if (!useList) {
      const res = _.keyBy(values, item => keyFunc(item))
      if (Object.keys(res).length === values.length) {
        return res
      }
      nonUniqueMapFields.push(fieldName)
    }
    return _.groupBy(values, item => keyFunc(item))
  }

  Object.entries(instanceMapFieldDef).filter(
    ([fieldName]) => instance.value[fieldName] !== undefined
  ).forEach(([fieldName, mapDef]) => {
    if (mapDef.nested) {
      const firstLevelGroups = _.groupBy(
        makeArray(instance.value[fieldName]),
        item => defaultMapper(item[mapDef.key])[0]
      )
      instance.value[fieldName] = _.mapValues(
        firstLevelGroups,
        firstLevelValues => convertField(
          firstLevelValues,
          item => defaultMapper(item[mapDef.key])[1],
          !!mapDef.mapToList,
          fieldName,
        )
      )
    } else {
      instance.value[fieldName] = convertField(
        makeArray(instance.value[fieldName]),
        item => defaultMapper(item[mapDef.key])[0],
        !!mapDef.mapToList,
        fieldName,
      )
    }
  })
  return nonUniqueMapFields
}

/**
 * Make sure all values in the specified non-unique fields are arrays.
 *
 * @param instance             The instance instance to update
 * @param nonUniqueMapFields  The list of fields to convert to arrays
 * @param instanceMapFieldDef  The original field mapping definition
 */
const convertValuesToMapArrays = (
  instance: InstanceElement,
  nonUniqueMapFields: string[],
  instanceMapFieldDef: Record<string, MapDef>,
): void => {
  nonUniqueMapFields.forEach(fieldName => {
    if (instanceMapFieldDef[fieldName]?.nested) {
      instance.value[fieldName] = _.mapValues(
        instance.value[fieldName],
        val => _.mapValues(val, makeArray),
      )
    } else {
      instance.value[fieldName] = _.mapValues(
        instance.value[fieldName],
        makeArray,
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
  instanceType: ObjectType,
  nonUniqueMapFields: string[],
  instanceMapFieldDef: Record<string, MapDef>,
): Promise<void> => {
  await awu(Object.values(instanceType.fields)).filter(
    async f => instanceMapFieldDef[f.name] !== undefined && !isMapType(await f.getType())
  ).forEach(async f => {
    const mapDef = instanceMapFieldDef[f.name]
    const fieldType = await f.getType()
    let innerType = isContainerType(fieldType) ? await fieldType.getInnerType() : fieldType
    if (mapDef.mapToList || nonUniqueMapFields.includes(f.name)) {
      innerType = new ListType(innerType)
    }
    if (mapDef.nested) {
      f.refType = createRefToElmWithValue(new MapType(new MapType(innerType)))
    } else {
      f.refType = createRefToElmWithValue(new MapType(innerType))
    }
  })
}

const convertInstanceFieldsToMaps = async (
  instancesToConvert: InstanceElement[],
  instanceMapFieldDef: Record<string, MapDef>,
): Promise<string[]> => {
  const nonUniqueMapFields = _.uniq(instancesToConvert.flatMap(
    instance => convertArraysToMaps(instance, instanceMapFieldDef)
  ))
  if (nonUniqueMapFields.length > 0) {
    log.info(`Converting the following fields to non-unique maps: ${nonUniqueMapFields},
     instances types are: ${
  await awu(instancesToConvert).map(inst => metadataType(inst)).toArray()
}`)
    instancesToConvert.forEach(instance => {
      convertValuesToMapArrays(instance, nonUniqueMapFields, instanceMapFieldDef)
    })
  }
  return nonUniqueMapFields
}

/**
 * Convert instance field values from maps back to arrays before deploy.
 *
 * @param instanceChanges          The instance changes to deploy
 * @param instanceMapFieldDef      The definitions of the fields to covert
 */
const convertFieldsBackToLists = async (
  instanceChanges: ReadonlyArray<Change<InstanceElement>>,
  instanceMapFieldDef: Record<string, MapDef>,
): Promise<void> => {
  const toVals = (values: Values): Values[] => Object.values(values).flat()

  const backToArrays = (instance: InstanceElement): InstanceElement => {
    Object.keys(instanceMapFieldDef).filter(
      fieldName => instance.value[fieldName] !== undefined
    ).forEach(fieldName => {
      if (Array.isArray(instance.value[fieldName])) {
        // should not happen
        return
      }

      if (instanceMapFieldDef[fieldName].nested) {
        // first convert the inner levels to arrays, then merge into one array
        instance.value[fieldName] = _.mapValues(instance.value[fieldName], toVals)
      }
      instance.value[fieldName] = toVals(instance.value[fieldName])
    })
    return instance
  }

  await awu(instanceChanges).forEach(instanceChange =>
    applyFunctionToChangeData(
      instanceChange,
      backToArrays,
    ))
}

/**
 * Convert instance's field values from arrays back to maps after deploy.
 *
 * @param instanceChanges  The instance changes to deploy
 * @param instanceMapFieldDef      The definitions of the fields to covert
 */
const convertFieldsBackToMaps = (
  instanceChanges: ReadonlyArray<Change<InstanceElement>>,
  instanceMapFieldDef: Record<string, MapDef>,
): void => {
  instanceChanges.forEach(instanceChange =>
    applyFunctionToChangeData(
      instanceChange,
      instance => {
        convertArraysToMaps(instance, instanceMapFieldDef)
        return instance
      },
    ))
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
  await awu(Object.values(instanceType.fields)).filter(
    async f => instanceMapFieldDef[f.name] !== undefined && isMapType(await f.getType())
  ).forEach(async f => {
    const fieldType = await f.getType()
    if (isMapType(fieldType)) {
      f.refType = createRefToElmWithValue(await fieldType.getInnerType())
    }
    // for nested fields (not using while to avoid edge cases)
    const newFieldType = await f.getType()
    if (isMapType(newFieldType)) {
      f.refType = createRefToElmWithValue(await newFieldType.getInnerType())
    }
  })
}

export const getInstanceChanges = (
  changes: ReadonlyArray<Change>,
  targetMetadataType: string,
): Promise<ReadonlyArray<Change<InstanceElement>>> => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(async change => await metadataType(getChangeElement(change)) === targetMetadataType)
    .toArray()
)

export const findInstancesToConvert = (
  elements: Element[],
  targetMetadataType: string,
): Promise<InstanceElement[]> => {
  const instances = elements.filter(isInstanceElement)
  return awu(instances).filter(async e => await metadataType(e) === targetMetadataType).toArray()
}

/**
 * Convert certain instances' fields into maps, so that they are easier to view,
 * could be referenced, and can be split across multiple files.
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    await awu(Object.keys(metadataTypeToFieldToMapDef)).forEach(async targetMetadataType => {
      if (targetMetadataType === PROFILE_METADATA_TYPE && config.useOldProfiles) {
        return
      }

      const instancesToConvert = await findInstancesToConvert(elements, targetMetadataType)
      if (instancesToConvert.length === 0) {
        return
      }
      const mapFieldDef = metadataTypeToFieldToMapDef[targetMetadataType]
      const nonUniqueMapFields = await convertInstanceFieldsToMaps(instancesToConvert, mapFieldDef)
      await updateFieldTypes(await instancesToConvert[0].getType(), nonUniqueMapFields, mapFieldDef)
    })
  },

  preDeploy: async changes => {
    await awu(Object.keys(metadataTypeToFieldToMapDef)).forEach(async targetMetadataType => {
      if (targetMetadataType === PROFILE_METADATA_TYPE && config.useOldProfiles) {
        return
      }
      const instanceChanges = await getInstanceChanges(changes, targetMetadataType)
      if (instanceChanges.length === 0) {
        return
      }
      const mapFieldDef = metadataTypeToFieldToMapDef[targetMetadataType]
      // since transformElement and salesforce do not require list fields to be defined as lists,
      // we only mark fields as lists of their map inner value is a list,
      // so that we can convert the object back correctly in onDeploy
      await convertFieldsBackToLists(instanceChanges, mapFieldDef)

      const instanceType = await getChangeElement(instanceChanges[0]).getType()
      await convertFieldTypesBackToLists(instanceType, mapFieldDef)
    })
  },

  onDeploy: async changes => {
    await awu(Object.keys(metadataTypeToFieldToMapDef)).forEach(async targetMetadataType => {
      if (targetMetadataType === PROFILE_METADATA_TYPE && config.useOldProfiles) {
        return
      }
      const instanceChanges = await getInstanceChanges(changes, targetMetadataType)
      if (instanceChanges.length === 0) {
        return
      }

      const mapFieldDef = metadataTypeToFieldToMapDef[targetMetadataType]
      convertFieldsBackToMaps(instanceChanges, mapFieldDef)

      const instanceType = await getChangeElement(instanceChanges[0]).getType()
      // after preDeploy, the fields with lists are exactly the ones that should be converted
      // back to lists
      const nonUniqueMapFields = await awu(Object.keys(instanceType.fields)).filter(
        async fieldName => isListType(await (instanceType.fields[fieldName].getType()))
      ).toArray()
      await updateFieldTypes(instanceType, nonUniqueMapFields, mapFieldDef)
    })

    return []
  },
})

export default filter
