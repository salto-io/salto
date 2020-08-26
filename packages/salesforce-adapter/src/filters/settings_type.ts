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
import { Element, isObjectType, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  createMetadataTypeElements, apiName,
} from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { ConfigChangeSuggestion } from '../types'
import { fetchMetadataInstances, listMetadataObjects } from '../fetch'

const log = logger(module)

export const SETTINGS_METADATA_TYPE = 'Settings'

// This method receiving settings type name and call to describeMetadataType
// And creating the new (settings) type
const createSettingsType = async (
  client: SalesforceClient,
  settingsTypesName: string,
  knownTypes: Map<string, TypeElement>
): Promise<ObjectType[]> => {
  const typeFields = await client.describeMetadataType(settingsTypesName)
  const baseTypeNames = new Set([settingsTypesName])
  try {
    return createMetadataTypeElements({
      name: settingsTypesName,
      fields: typeFields.valueTypeFields,
      knownTypes,
      baseTypeNames,
      childTypeNames: new Set(),
      client,
      isSettings: true,
    })
  } catch (e) {
    log.error('failed to fetch settings type %s reason: %o', settingsTypesName, e)
    return []
  }
}

const getSettingsTypeName = (typeName: string): string => typeName.concat(SETTINGS_METADATA_TYPE)

/**
 * Add settings type
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  /**
   * Add all settings types and instances as filter.
   *
   * @param elements
   */
  onFetch: async (elements: Element[]): Promise<ConfigChangeSuggestion[]> => {
    // Fetch list of all settings types
    const {
      elements: settingsList, configChanges: listObjectsConfigChanges,
    } = await listMetadataObjects(
      client, SETTINGS_METADATA_TYPE, [], () => true
    )

    // Use known types to avoid overriding existing types
    const knownTypes = new Map(
      elements.filter(isObjectType).map(e => [apiName(e), e])
    )

    const settingsTypeInfos = settingsList.filter(info => (
      !(config.metadataTypesSkippedList ?? []).includes(getSettingsTypeName(info.fullName))
    ))

    // Create settings types
    const settingsTypes = (await Promise.all(
      settingsTypeInfos
        .map(info => getSettingsTypeName(info.fullName))
        .map(typeName => createSettingsType(client, typeName, knownTypes))
    )).flat()
    elements.push(...settingsTypes)

    // Create settings instances
    const settingsTypeByName = _.keyBy(settingsTypes, type => apiName(type))
    const settingsInstanceCreateResults = await Promise.all(
      settingsTypeInfos
        .map(info => ({ info, type: settingsTypeByName[getSettingsTypeName(info.fullName)] }))
        .filter(({ type }) => type !== undefined)
        .map(({ info, type }) => fetchMetadataInstances({
          client,
          metadataType: type,
          fileProps: [info],
          instancesRegexSkippedList: config.instancesRegexSkippedList,
        }))
    )
    const settingsInstances = settingsInstanceCreateResults.flatMap(res => res.elements)
    const instancesConfigChanges = settingsInstanceCreateResults.flatMap(res => res.configChanges)
    elements.push(...settingsInstances)

    return [...instancesConfigChanges, ...listObjectsConfigChanges]
  },
})

export default filterCreator
