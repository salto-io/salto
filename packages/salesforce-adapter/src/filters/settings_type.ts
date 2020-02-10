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
  Element, InstanceElement, isObjectType,
  ObjectType, TypeElement,
} from 'adapter-api'
import { logger } from '@salto/logging'
import { MetadataInfo } from 'jsforce-types'
import { FilterCreator } from '../filter'
import {
  createInstanceElement, createMetadataTypeElements, apiName,
} from '../transformers/transformer'
import SalesforceClient from '../client/client'
import { id } from './utils'

const log = logger(module)

export const SETTINGS_METADATA_TYPE = 'Settings'

// This method receiving settings type name and call to describeMetadataType
// And creating the new (settings) type
const createSettingsType = async (
  client: SalesforceClient,
  settingsTypesName: string,
  knownTypes: Map<string, TypeElement>): Promise<ObjectType[]> => {
  const typeFields = await client.describeMetadataType(settingsTypesName)
  const baseTypeNames = new Set([settingsTypesName])
  return createMetadataTypeElements(settingsTypesName, typeFields, knownTypes, baseTypeNames,
    client, true)
}

const createSettingsTypes = async (
  client: SalesforceClient,
  settingsTypesNames: string[]): Promise<ObjectType[]> => {
  const knownTypes = new Map<string, TypeElement>()
  return _.flatten(await Promise.all(settingsTypesNames
    .map(settingsName => settingsName.concat(SETTINGS_METADATA_TYPE))
    .map(settingsTypesName => createSettingsType(client, settingsTypesName, knownTypes)
      .catch(e => {
        log.error('failed to fetch settings type %s reason: %o', settingsTypesName, e)
        return []
      }))))
}

const extractSettingName = (settingType: string): string =>
  (settingType.endsWith(SETTINGS_METADATA_TYPE) ? settingType.slice(0, -8) : settingType)

// This method receiving settings type and call to readMetadata
// And creating the new instance
const createSettingsInstance = async (
  client: SalesforceClient,
  settingsType: ObjectType
): Promise<InstanceElement[]> => {
  const typeName = apiName(settingsType)
  let metadataInfos: MetadataInfo[] = []
  try {
    metadataInfos = await client.readMetadata(typeName, extractSettingName(typeName))
  } catch (e) {
    log.error('failed to fetch settings instances of type %s reason: %o', typeName, e)
  }
  return metadataInfos
    .filter(m => m.fullName !== undefined)
    .map(m => createInstanceElement(m, settingsType))
}

const createSettingsInstances = async (
  client: SalesforceClient,
  settingsTypes: ObjectType[]
): Promise<InstanceElement[]> => {
  const settingInstances = await Promise.all((settingsTypes)
    .filter(s => s.isSettings)
    .map(s => createSettingsInstance(client, s)))
  return _.flatten(settingInstances)
}

/**
 * Add settings type
 */
const filterCreator: FilterCreator = ({ client }) => ({
  /**
   * Add all settings types and instances as filter.
   *
   * @param elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    // Fetch list of all settings types
    const settingsList = await client.listMetadataObjects({ type: SETTINGS_METADATA_TYPE })

    // Extract settings names
    const settingsTypesNames = settingsList.map(set => set.fullName)

    // Create all settings types
    const settingsTypes = await createSettingsTypes(client, settingsTypesNames)

    // Add all settings types to elements
    const knownTypesNames = new Set<string>(
      elements.filter(e => isObjectType(e)).map(a => id(a))
    )
    settingsTypes
      .filter(st => !knownTypesNames.has(id(st)))
      .forEach(e => elements.push(e))

    // Create all settings instances
    const settingsInstances = await createSettingsInstances(client, settingsTypes)

    settingsInstances.forEach(e => elements.push(e))
  },
})

export default filterCreator
