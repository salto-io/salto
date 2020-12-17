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

import _ from 'lodash'
import {
  Element, ObjectType, isContainerType, MapType, ListType, InstanceElement, isInstanceElement,
  Values, isAdditionOrModificationChange, isInstanceChange, getChangeElement, Change, isMapType,
  isListType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { naclCase, applyFunctionToChangeData, createRefToElmWithValue } from '@salto-io/adapter-utils'
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
  userPermissions: { key: 'name' },

  // Non-unique maps (multiple values can have the same key)
  categoryGroupVisibilities: { key: 'dataCategoryGroup', mapToList: true },
  layoutAssignments: { key: 'layout', mapToList: true },

  // Two-level maps
  fieldPermissions: { key: 'field', nested: true },
  fieldLevelSecurities: { key: 'field', nested: true }, // only available in API version 22.0 and earlier
  recordTypeVisibilities: { key: 'recordType', nested: true },
}

/**
 * Convert the specified profile fields into maps.
 * Choose between unique maps and lists based on each field's conversion definition. If a field
 * should use a unique map but fails due to conflicts, convert it to a list map, and include it
 * in the returned list so that it can be converted across the board.
 *
 * @param profile             The profile to modify
 * @param profileMapFieldDef  The definitions of the fields to covert
 * @returns                   The list of fields that were converted to non-unique due to duplicates
 */
const convertArraysToMaps = (
  profile: InstanceElement,
  profileMapFieldDef: Record<string, MapDef>,
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

  Object.entries(profileMapFieldDef).filter(
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
 * @param profileMapFieldDef  The original field mapping definition
 */
const convertValuesToMapArrays = (
  profile: InstanceElement,
  nonUniqueMapFields: string[],
  profileMapFieldDef: Record<string, MapDef>,
): void => {
  nonUniqueMapFields.forEach(fieldName => {
    if (profileMapFieldDef[fieldName]?.nested) {
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
 * @param profileMapFieldDef  The original field mapping definition
 */
const updateFieldTypes = (
  profileObj: ObjectType,
  nonUniqueMapFields: string[],
  profileMapFieldDef: Record<string, MapDef>,
): void => {
  Object.values(profileObj.fields).filter(
    f => profileMapFieldDef[f.name] !== undefined && !isMapType(f.getType())
  ).forEach(f => {
    const mapDef = profileMapFieldDef[f.name]
    const fieldType = f.getType()
    let innerType = isContainerType(fieldType) ? fieldType.getInnerType() : fieldType
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

const convertInstanceFieldsToMaps = (
  profileInstances: InstanceElement[],
  profileMapFieldDef: Record<string, MapDef>,
): string[] => {
  const nonUniqueMapFields = _.uniq(profileInstances.flatMap(
    profile => convertArraysToMaps(profile, profileMapFieldDef)
  ))
  if (nonUniqueMapFields.length > 0) {
    log.info(`Converting the following profile fields to non-unique maps: ${nonUniqueMapFields}`)
    profileInstances.forEach(profile => {
      convertValuesToMapArrays(profile, nonUniqueMapFields, profileMapFieldDef)
    })
  }
  return nonUniqueMapFields
}

/**
 * Convert profile field values from maps back to arrays before deploy.
 *
 * @param profileInstanceChanges  The profile instance changes to deploy
 * @param profileMapFieldDef      The definitions of the fields to covert
 */
const convertFieldsBackToLists = (
  profileInstanceChanges: ReadonlyArray<Change<InstanceElement>>,
  profileMapFieldDef: Record<string, MapDef>,
): void => {
  const toVals = (values: Values): Values[] => Object.values(values).flat()

  const backToArrays = (profile: InstanceElement): InstanceElement => {
    Object.keys(profileMapFieldDef).filter(
      fieldName => profile.value[fieldName] !== undefined
    ).forEach(fieldName => {
      if (Array.isArray(profile.value[fieldName])) {
        // should not happen
        return
      }

      if (profileMapFieldDef[fieldName].nested) {
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
 * Convert profile field values from arrays back to maps after deploy.
 *
 * @param profileInstanceChanges  The profile instance changes to deploy
 * @param profileMapFieldDef      The definitions of the fields to covert
 */
const convertFieldsBackToMaps = (
  profileInstanceChanges: ReadonlyArray<Change<InstanceElement>>,
  profileMapFieldDef: Record<string, MapDef>,
): void => {
  profileInstanceChanges.forEach(profileChange =>
    applyFunctionToChangeData(
      profileChange,
      profile => {
        convertArraysToMaps(profile, profileMapFieldDef)
        return profile
      },
    ))
}

/**
 * Convert fields from maps back to lists pre-deploy.
 *
 * @param profileObj          The profile to update
 * @param profileMapFieldDef  The field mapping definition
 */
const convertFieldTypesBackToLists = (
  profileObj: ObjectType,
  profileMapFieldDef: Record<string, MapDef>,
): void => {
  Object.values(profileObj.fields).filter(
    f => profileMapFieldDef[f.name] !== undefined && isMapType(f.getType())
  ).forEach(f => {
    const fieldType = f.getType()
    if (isMapType(fieldType)) {
      f.refType = createRefToElmWithValue(fieldType.getInnerType())
    }
    // for nested fields (not using while to avoid edge cases)
    const newFieldType = f.getType()
    if (isMapType(newFieldType)) {
      f.refType = createRefToElmWithValue(newFieldType.getInnerType())
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

export const findProfileInstances = (
  elements: Element[],
): InstanceElement[] => {
  const instances = elements.filter(isInstanceElement)
  return instances.filter(e => metadataType(e) === PROFILE_METADATA_TYPE)
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

    updateFieldTypes(profileInstances[0].getType(), nonUniqueMapFields, PROFILE_MAP_FIELD_DEF)
  },

  preDeploy: async changes => {
    if (config.useOldProfiles) {
      return
    }

    const profileInstanceChanges = getInstanceChanges(changes)
    if (profileInstanceChanges.length === 0) {
      return
    }
    // since transformElement and salesforce do not require list fields to be defined as lists,
    // we only mark fields as lists of their map inner value is a list,
    // so that we can convert the object back correctly in onDeploy
    convertFieldsBackToLists(profileInstanceChanges, PROFILE_MAP_FIELD_DEF)

    const profileObj = getChangeElement(profileInstanceChanges[0]).getType()
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
    convertFieldsBackToMaps(profileInstanceChanges, PROFILE_MAP_FIELD_DEF)

    const profileObj = getChangeElement(profileInstanceChanges[0]).getType()
    // after preDeploy, the fields with lists are exactly the ones that should be converted
    // back to lists
    const nonUniqueMapFields = Object.keys(profileObj.fields).filter(
      fieldName => isListType((profileObj.fields[fieldName].getType()))
    )
    updateFieldTypes(profileObj, nonUniqueMapFields, PROFILE_MAP_FIELD_DEF)

    return []
  },
})

export default filter
