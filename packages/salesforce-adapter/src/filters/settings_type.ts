/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, isObjectType, ObjectType, TypeElement } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterResult, RemoteFilterCreator } from '../filter'
import { createMetadataTypeElements, apiName } from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { SETTINGS_METADATA_TYPE } from '../constants'
import { fetchMetadataInstances, listMetadataObjects } from '../fetch'

const { awu } = collections.asynciterable
const log = logger(module)

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
    return await createMetadataTypeElements({
      name: settingsTypesName,
      fields: typeFields.valueTypeFields,
      knownTypes,
      baseTypeNames,
      childTypeNames: new Set(),
      client,
      isSettings: true,
      annotations: {
        suffix: 'settings',
        dirName: 'settings',
      },
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
const filterCreator: RemoteFilterCreator = ({ client, config }) => ({
  name: 'settingsFilter',
  /**
   * Add all settings types and instances as filter.
   *
   * @param elements
   */
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    // Fetch list of all settings types
    const {
      elements: settingsList, configChanges: listObjectsConfigChanges,
    } = await listMetadataObjects(
      client, SETTINGS_METADATA_TYPE, () => true
    )

    const settingsTypeInfos = settingsList.filter(
      info => (config.fetchProfile.metadataQuery)
        .isTypeMatch(getSettingsTypeName(info.fullName))
    )

    // Create settings types
    const knownTypes: Map<string, TypeElement> = new Map()
    const objectTypes = elements.filter(isObjectType)
    await awu(objectTypes)
      .forEach(async e => knownTypes.set(await apiName(e), e))

    const settingsTypes = (await Promise.all(
      settingsTypeInfos
        .map(info => getSettingsTypeName(info.fullName))
        .map(typeName => createSettingsType(client, typeName, knownTypes))
    )).flat()
    elements.push(...settingsTypes)

    // Create settings instances
    const settingsTypeByName = await awu(settingsTypes).keyBy(type => apiName(type))
    const settingsInstanceCreateResults = await Promise.all(
      settingsTypeInfos
        .map(info => ({ info, type: settingsTypeByName[getSettingsTypeName(info.fullName)] }))
        .filter(({ type }) => type !== undefined)
        .map(({ info, type }) => fetchMetadataInstances({
          client,
          metadataType: type,
          fileProps: [info],
          metadataQuery: config.fetchProfile.metadataQuery,
          maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
        }))
    )
    const settingsInstances = settingsInstanceCreateResults.flatMap(res => res.elements)
    const instancesConfigChanges = settingsInstanceCreateResults.flatMap(res => res.configChanges)
    elements.push(...settingsInstances)

    return {
      configSuggestions: [...instancesConfigChanges, ...listObjectsConfigChanges],
    }
  },

  // after onFetch, the settings types have annotations.metadataType === '<name>Settings',
  // which causes deploy to fail (SALTO-1081).
  // We currently don't fix the metadata type in a preDeploy & onDeploy mechanism,
  // since the '<name>Settings' format is required for comparison with the type specified in the
  // deploy response, which is also in this format (after preDeploy and before onDeploy).
  // instead, we change the type in the deploy pkg (PR #1727).

})

export default filterCreator
