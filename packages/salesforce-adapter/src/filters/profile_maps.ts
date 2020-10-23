/*
*                      Copyright 2020 Salto Labs Ltd.
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

import wu from 'wu'
import _ from 'lodash'
import {
  Element, ObjectType, isContainerType, MapType, ListType, InstanceElement, isInstanceElement,
  Values, isAdditionOrModificationChange, isInstanceChange, getChangeElement, Change, isMapType,
  getAllChangeElements, isListType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { naclCase, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { API_NAME_SEPARATOR, PROFILE_METADATA_TYPE } from '../constants'
import { metadataType } from '../transformers/transformer'

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
 * so this filter has to run before any filter adding references on the profile objects.
 */
export const defaultMapper = (val: string): string[] => (
  val.split(API_NAME_SEPARATOR).map(v => naclCase(v))
)

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
  recordTypeVisibilities: { key: 'recordType' },
  userPermissions: { key: 'name' },

  // Non-unique maps (multiple values can have the same key)
  categoryGroupVisibilities: { key: 'dataCategoryGroup', mapToList: true },
  layoutAssignments: { key: 'layout', mapToList: true },

  // Two-level maps
  fieldPermissions: { key: 'field', nested: true },
  fieldLevelSecurities: { key: 'field', nested: true }, // only available in API version 22.0 and earlier
}

/**
 * Convert the specified profile fields into maps.
 * Choose between unique maps and lists based on each field's conversion definition. If a field
 * should use a unique map but fails due to conflicts, convert it to a list map, and include it
 * in the returned list so that it can be converted across the board.
 *
 * @param profile             The profile to modify
 * @param profileMapFielDef   The definitions of the fields to covert
 * @returns                   The list of fields that were converted to non-unique due to duplicates
 */
const convertArraysToMaps = (
  profile: InstanceElement,
  profileMapFielDef: Record<string, MapDef>,
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

  Object.entries(profileMapFielDef).filter(
    ([fieldName]) => profile.value[fieldName] !== undefined
  ).forEach(([fieldName, mapDef]) => {
    if (mapDef.nested) {
      const firstLevelGroups = _.groupBy(
        makeArray(profile.value[fieldName]),
        item => defaultMapper(item[mapDef.key])[0]
      )
      profile.value[fieldName] = _.mapValues(
        firstLevelGroups,
        firstLevelValues => convertField(
          firstLevelValues,
          item => defaultMapper(item[mapDef.key])[1],
          !!mapDef.mapToList,
          fieldName,
        )
      )
    } else {
      profile.value[fieldName] = convertField(
        makeArray(profile.value[fieldName]),
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
 * @param profile             The profile instance to update
 * @param nonUniqueMapFields  The list of fields to convert to arrays
 * @param profileMapFielDef   The original field mapping definition
 */
const convertValuesToMapArrays = (
  profile: InstanceElement,
  nonUniqueMapFields: string[],
  profileMapFielDef: Record<string, MapDef>,
): void => {
  nonUniqueMapFields.forEach(fieldName => {
    if (profileMapFielDef[fieldName]?.nested) {
      profile.value[fieldName] = _.mapValues(
        profile.value[fieldName],
        val => _.mapValues(val, makeArray),
      )
    } else {
      profile.value[fieldName] = _.mapValues(
        profile.value[fieldName],
        makeArray,
      )
    }
  })
}

/**
 * Update the profile object type's fields to use maps.
 *
 * @param profileObj          The profile to update
 * @param nonUniqueMapFields  The list of fields to convert to arrays
 * @param profileMapFielDef   The original field mapping definition
 */
const updateFieldTypes = (
  profileObj: ObjectType,
  nonUniqueMapFields: string[],
  profileMapFielDef: Record<string, MapDef>,
): void => {
  Object.values(profileObj.fields).filter(
    f => profileMapFielDef[f.name] !== undefined && !isMapType(f.type)
  ).forEach(f => {
    const mapDef = profileMapFielDef[f.name]
    let innerTYpe = isContainerType(f.type) ? f.type.innerType : f.type
    if (mapDef.mapToList || nonUniqueMapFields?.includes(f.name)) {
      innerTYpe = new ListType(innerTYpe)
    }
    if (mapDef.nested) {
      f.type = new MapType(new MapType(innerTYpe))
    } else {
      f.type = new MapType(innerTYpe)
    }
  })
}

const convertInstanceFieldsToMaps = (
  profileInstances: InstanceElement[],
  profileMapFielDef: Record<string, MapDef>,
): string[] => {
  const nonUniqueMapFields = _.uniq(profileInstances.flatMap(
    profile => convertArraysToMaps(profile, profileMapFielDef)
  ))
  if (nonUniqueMapFields.length > 0) {
    log.info(`Converting the following profile fields to non-unique maps: ${nonUniqueMapFields}`)
    profileInstances.forEach(profile => {
      convertValuesToMapArrays(profile, nonUniqueMapFields, profileMapFielDef)
    })
  }
  return nonUniqueMapFields
}

/**
 * Convert profile field values from maps back to arrays before deploy.
 *
 * @param profileInstanceChanges  The profile instance changes to deploy
 * @param profileMapFielDef       The definitions of the fields to covert
 */
const convertFieldsBackToLists = (
  profileInstanceChanges: ReadonlyArray<Change<InstanceElement>>,
  profileMapFielDef: Record<string, MapDef>,
): void => {
  const toVals = (values: Values): Values[] => Object.values(values).flat()

  const backToArrays = (profile: InstanceElement): InstanceElement => {
    Object.keys(profileMapFielDef).filter(
      fieldName => profile.value[fieldName] !== undefined
    ).forEach(fieldName => {
      if (Array.isArray(profile.value[fieldName])) {
        // should not happen
        return
      }

      if (profileMapFielDef[fieldName].nested) {
        // first convert the inner levels to arrays, then merge into one array
        profile.value[fieldName] = _.mapValues(profile.value[fieldName], toVals)
      }
      profile.value[fieldName] = toVals(profile.value[fieldName])
    })
    return profile
  }

  profileInstanceChanges.forEach(profileChange =>
    applyFunctionToChangeData(
      profileChange,
      backToArrays,
    ))
}

/**
 * Convert fields from maps back to lists pre-deploy.
 *
 * @param profileObj          The profile to update
 * @param profileMapFielDef   The field mapping definition
 */
const convertFieldTypesBackToLists = (
  profileObj: ObjectType,
  profileMapFielDef: Record<string, MapDef>,
): void => {
  Object.values(profileObj.fields).filter(
    f => profileMapFielDef[f.name] !== undefined && isMapType(f.type)
  ).forEach(f => {
    if (isMapType(f.type)) {
      f.type = f.type.innerType
    }
    // for nested fields (not using while to avoid edge cases)
    if (isMapType(f.type)) {
      f.type = f.type.innerType
    }
  })
}

export const getInstanceChanges = (
  changes: ReadonlyArray<Change>
): ReadonlyArray<Change<InstanceElement>> => (
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => metadataType(getChangeElement(change)) === PROFILE_METADATA_TYPE)
)

const findProfileInstances = (
  elements: Iterable<Element>,
): InstanceElement[] => {
  const instances = wu(elements).filter(isInstanceElement) as wu.WuIterable<InstanceElement>
  return [...instances.filter(e => metadataType(e) === PROFILE_METADATA_TYPE)]
}

/**
 * Convert profile fields that are known to be lists into maps, so that they are easier to view
 * and can be split across multiple files.
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    if (config.useOldProfiles) {
      return
    }

    const profileInstances = findProfileInstances(elements)
    if (profileInstances.length === 0) {
      return
    }

    const nonUniqueMapFields = convertInstanceFieldsToMaps(profileInstances, PROFILE_MAP_FIELD_DEF)

    updateFieldTypes(profileInstances[0].type, nonUniqueMapFields, PROFILE_MAP_FIELD_DEF)
  },

  preDeploy: async changes => {
    if (config.useOldProfiles) {
      return
    }

    const profileInstanceChanges = getInstanceChanges(changes)
    if (profileInstanceChanges.length === 0) {
      return
    }
    convertFieldsBackToLists(profileInstanceChanges, PROFILE_MAP_FIELD_DEF)

    const profileObj = getChangeElement(profileInstanceChanges[0]).type
    convertFieldTypesBackToLists(profileObj, PROFILE_MAP_FIELD_DEF)
  },

  onDeploy: async changes => {
    if (config.useOldProfiles) {
      return []
    }

    const profileInstanceChanges = getInstanceChanges(changes)
    if (profileInstanceChanges.length === 0) {
      return []
    }
    // since salesforce does not require list fields to be defined as lists,
    // we only mark fields as lists of their map inner value is a list,
    // so that we can convert the object back correctly in onDeploy
    convertInstanceFieldsToMaps(
      profileInstanceChanges.flatMap(getAllChangeElements),
      PROFILE_MAP_FIELD_DEF,
    )

    const profileObj = getChangeElement(profileInstanceChanges[0]).type
    // after preDeploy, the fields with lists are exactly the ones that should be converted
    // back to lists
    const nonUniqueMapFields = Object.keys(profileObj.fields).filter(
      fieldName => isListType((profileObj.fields[fieldName].type))
    )
    updateFieldTypes(profileObj, nonUniqueMapFields, PROFILE_MAP_FIELD_DEF)

    return []
  },
})

export default filter
