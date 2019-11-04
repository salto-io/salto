import {
  Element, InstanceElement, ObjectType, Type,
} from 'adapter-api'
import { FilterCreator } from '../filter'
import {
  createInstanceElement, createMetadataTypeElements, sfCase,
} from '../transformer'
import SalesforceClient from '../client/client'

export const SETTINGS_METADATA_TYPE = 'Settings'

const createSettingsTypes = async (
  client: SalesforceClient,
  settingsTypesNames: string[]): Promise<ObjectType[]> => {
  const res = settingsTypesNames
    .map(name => name.concat(SETTINGS_METADATA_TYPE))
    .map(async e => {
      const typeFields = await client.describeMetadataType(e)
      return createMetadataTypeElements(
        e,
        typeFields,
        new Map<string, Type>(),
        false,
        true,
      )[0]
    })

  return Promise.all(res)
}

const extractSettingName = (settingType: string): string =>
  (settingType.endsWith(SETTINGS_METADATA_TYPE) ? settingType.slice(0, -8) : settingType)

const createSettingsInstances = (
  client: SalesforceClient,
  settingsTypes: ObjectType[]
): Promise<InstanceElement>[] => settingsTypes.map(async st => {
  const settingType = sfCase(st.elemID.name)
  // We pass readMetadata api type and name
  // When the type is name+'Settings'
  const metadataInfos = await client.readMetadata(
    settingType,
    extractSettingName(settingType),
  )
  return createInstanceElement(metadataInfos[0], st)
})

/**
 * Add settings type
 */
const filterCreator: FilterCreator = ({ client }) => ({
  /**
   * Add settings type
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
    settingsTypes.forEach(e => elements.push(e))

    // Create all settings instances
    const settingsInstances = createSettingsInstances(client, settingsTypes)

    await Promise.all(settingsInstances.map(async e =>
      elements.push(await e)))
  },
})

export default filterCreator
