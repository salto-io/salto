import _ from 'lodash'
import {
  Element, InstanceElement, isObjectType,
  ObjectType, Type,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import {
  createInstanceElement, createMetadataTypeElements, sfCase,
} from '../transformer'
import SalesforceClient from '../client/client'

export const SETTINGS_METADATA_TYPE = 'Settings'

// This method receiving settings type name and call to describeMetadataType
// And creating the new (settings) type
const createSettingsType = async (
  client: SalesforceClient,
  settingsTypesName: string,
  knownTypes: Map<string, Type>): Promise<ObjectType[]> => {
  const typeFields = await client.describeMetadataType(settingsTypesName)
  const baseTypeNames = new Set([settingsTypesName, ...typeFields.map(f => f.name)])
  return createMetadataTypeElements(settingsTypesName, typeFields, knownTypes, baseTypeNames, true)
}

const createSettingsTypes = async (
  client: SalesforceClient,
  settingsTypesNames: string[]): Promise<ObjectType[]> => {
  const knownTypes = new Map<string, Type>()
  return _.flatten(await Promise.all(settingsTypesNames
    .map(settingsName => settingsName.concat(SETTINGS_METADATA_TYPE))
    .map(settingsTypesName => createSettingsType(client, settingsTypesName, knownTypes))))
}

const extractSettingName = (settingType: string): string =>
  (settingType.endsWith(SETTINGS_METADATA_TYPE) ? settingType.slice(0, -8) : settingType)

// This method receiving settings type and call to readMetadata
// And creating the new instance
const createSettingsInstance = async (
  client: SalesforceClient,
  settingsType: ObjectType
): Promise<InstanceElement[]> => {
  const typeName = sfCase(settingsType.elemID.name)
  const metadataInfos = await client.readMetadata(
    typeName,
    extractSettingName(typeName),
  )
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
    const settingsList = await client.listMetadataObjects(SETTINGS_METADATA_TYPE)

    // Extract settings names
    const settingsTypesNames = settingsList.map(set => set.fullName)

    // Create all settings types
    const settingsTypes = await createSettingsTypes(client, settingsTypesNames)

    // Add all settings types to elements
    const knownTypesNames = new Set<string>(
      elements.filter(e => isObjectType(e)).map(a => a.elemID.getFullName())
    )
    settingsTypes
      .filter(st => !knownTypesNames.has(st.elemID.getFullName()))
      .forEach(e => elements.push(e))

    // Create all settings instances
    const settingsInstances = await createSettingsInstances(client, settingsTypes)

    settingsInstances.forEach(e => elements.push(e))
  },
})

export default filterCreator
