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
  ElemID, Element, isObjectType, ObjectType, isContainerType, MapType, ListType, InstanceElement,
  Values,
  isAdditionOrModificationChange,
  isInstanceChange,
  getChangeElement,
  Change,
  isMapType,
  isListType,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { findInstances, naclCase, applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { API_NAME_SEPARATOR, PROFILE_METADATA_TYPE, SALESFORCE } from '../constants'
import { metadataType } from '../transformers/transformer'

const { makeArray } = collections.array
const log = logger(module)

export const PROFILE_TYPE_ID = new ElemID(SALESFORCE, PROFILE_METADATA_TYPE)

type NameFunc = (fieldValue: string) => string[]
type MapKeyFunc = (value: Values) => string

/**
 * Convert a string value into the map index keys.
 * Note: Reference expressions are not supported yet (the resolved value is not populated in fetch)
 * so this filter has to run before any filter adding references on the profile objects.
 */
const defaultMapper: NameFunc = (val: string) => val.split(API_NAME_SEPARATOR).map(v => naclCase(v))

type MapDef = {
  key: string
  nested?: boolean
  alwaysAllowRepetitions?: boolean
}

const PROFILE_MAP_FIELD_DEF: Record<string, MapDef> = {
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
  categoryGroupVisibilities: { key: 'dataCategoryGroup', alwaysAllowRepetitions: true },
  layoutAssignments: { key: 'layout', alwaysAllowRepetitions: true },

  // Two-level maps
  fieldPermissions: { key: 'field', nested: true },
  // Only available in API version 22.0 and earlier
  fieldLevelSecurities: { key: 'field', nested: true },
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
  const nonUniqueMapFields: string[] = []

  const toUniqueMap = (values: Values[], keyFunc: MapKeyFunc): Values => {
    const res = _.keyBy(values, item => keyFunc(item))
    if (Object.keys(res).length !== values.length) {
      throw new Error('Non-unique profile field map')
    }
    return res
  }
  const toListMap = (values: Values[], keyFunc: MapKeyFunc): Values => (
    _.groupBy(values, item => keyFunc(item))
  )
  const convertField = (
    values: Values[],
    keyFunc: MapKeyFunc,
    useList: boolean,
    fieldName: string,
  ): Values => {
    if (!useList) {
      try {
        return toUniqueMap(
          values,
          item => keyFunc(item),
        )
      } catch (e) {
        nonUniqueMapFields.push(fieldName)
      }
    }
    return toListMap(
      values,
      item => keyFunc(item),
    )
  }

  Object.keys(profileMapFielDef).filter(
    fieldName => profile.value[fieldName] !== undefined
  ).forEach(fieldName => {
    const mapDef = profileMapFielDef[fieldName]
    if (mapDef.nested) {
      const newVal = toListMap(
        makeArray(profile.value[fieldName]),
        item => defaultMapper(item[mapDef.key])[0],
      )
      Object.keys(newVal).forEach(innerFieldName => {
        newVal[innerFieldName] = convertField(
          newVal[innerFieldName],
          item => defaultMapper(item[mapDef.key])[1],
          !!mapDef.alwaysAllowRepetitions,
          innerFieldName,
        )
      })
      profile.value[fieldName] = newVal
    } else {
      profile.value[fieldName] = convertField(
        makeArray(profile.value[fieldName]),
        item => defaultMapper(item[mapDef.key])[0],
        !!mapDef.alwaysAllowRepetitions,
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
    if (mapDef.alwaysAllowRepetitions || nonUniqueMapFields?.includes(f.name)) {
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
  const backToArrays = (profile: InstanceElement): InstanceElement => {
    Object.keys(profileMapFielDef).filter(
      fieldName => profile.value[fieldName] !== undefined
    ).forEach(fieldName => {
      if (Array.isArray(profile.value[fieldName])) {
        // already updated (modification change)
        return
      }
      const toVals = (values: Values): Values[] => _.flatMap(Object.values(values))
      if (profileMapFielDef[fieldName].nested) {
        profile.value[fieldName] = _.mapValues(profile.value[fieldName], toVals)
      }
      profile.value[fieldName] = toVals(profile.value[fieldName]).sort()
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

const getInstanceChanges = (
  changes: ReadonlyArray<Change>
): ReadonlyArray<Change<InstanceElement>> => (
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => getChangeElement(change).type.elemID.isEqual(PROFILE_TYPE_ID))
)

const hasMapFields = (obj: ObjectType): boolean => (
  Object.values(obj.fields).some(f => isMapType(f.type))
)

/**
 * Convert profile fields that are known to be lists into maps, so that they are easier to view
 * and can be split across multiple files.
 */
const filter: FilterCreator = ({ config }) => ({
  onFetch: async (elements: Element[]) => {
    if (config.useOldProfiles) {
      log.info('Not converting profiles to maps on fetch')
      return
    }
    const profileInstances = [...findInstances(elements, PROFILE_TYPE_ID)]
    const profileObj = elements.filter(isObjectType).find(
      e => metadataType(e) === PROFILE_METADATA_TYPE
    )
    const nonUniqueMapFields = convertInstanceFieldsToMaps(profileInstances, PROFILE_MAP_FIELD_DEF)
    if (profileObj === undefined) {
      log.warn('Profile object type not found')
      return
    }
    updateFieldTypes(profileObj, nonUniqueMapFields, PROFILE_MAP_FIELD_DEF)
  },

  preDeploy: async changes => {
    const profileInstanceChanges = getInstanceChanges(changes)
    if (profileInstanceChanges.length === 0) {
      return
    }
    const profileObj = getChangeElement(profileInstanceChanges[0]).type
    if (!hasMapFields(profileObj)) {
      log.info('Profiles are not using map format - skipping preDeploy')
      return
    }
    convertFieldsBackToLists(profileInstanceChanges, PROFILE_MAP_FIELD_DEF)
    convertFieldTypesBackToLists(
      profileObj,
      PROFILE_MAP_FIELD_DEF,
    )
  },

  onDeploy: async changes => {
    if (config.useOldProfiles) {
      log.info('Not converting profiles back to maps on deploy')
      return []
    }
    const profileInstanceChanges = getInstanceChanges(changes)
    if (profileInstanceChanges.length === 0) {
      return []
    }
    const profileObj = getChangeElement(profileInstanceChanges[0]).type
    // after preDeploy, the fields with lists are exactly the ones that should be converted
    // back to lists
    const nonUniqueMapFields = Object.keys(profileObj.fields).filter(
      fieldName => isListType((profileObj.fields[fieldName].type))
    )
    const modifiedProfileInstances = profileInstanceChanges.map(getChangeElement)
    convertInstanceFieldsToMaps(modifiedProfileInstances, PROFILE_MAP_FIELD_DEF)
    updateFieldTypes(profileObj, nonUniqueMapFields, PROFILE_MAP_FIELD_DEF)
    return []
  },
})

export default filter
