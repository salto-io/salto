/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterResult, FilterCreator } from '../filter'
import { isCustomSettingsObject, apiName } from '../transformers/transformer'
import { getAllInstances, getCustomObjectsFetchSettings, CustomObjectFetchSetting } from './custom_objects_instances'
import { CUSTOM_SETTINGS_TYPE, LIST_CUSTOM_SETTINGS_TYPE } from '../constants'
import { buildDataManagement } from '../fetch_profile/data_management'

const { awu, keyByAsync } = collections.asynciterable
const log = logger(module)

export const isListCustomSettingsObject = (obj: ObjectType): boolean =>
  isCustomSettingsObject(obj) && obj.annotations[CUSTOM_SETTINGS_TYPE] === LIST_CUSTOM_SETTINGS_TYPE

const logInvalidCustomSettings = async (invalidCustomSettings: CustomObjectFetchSetting[]): Promise<void> =>
  awu(invalidCustomSettings).forEach(async settings =>
    log.debug(
      `Did not fetch instances for Custom Setting - ${await apiName(settings.objectType)} cause ${settings.invalidIdFields} do not exist or are not queryable`,
    ),
  )

const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'customSettingsFilter',
  onFetch: async (elements: Element[]): Promise<FilterResult> => {
    if (client === undefined) {
      return {}
    }

    if (!config.fetchProfile.shouldFetchAllCustomSettings()) {
      return {}
    }

    const customSettingsObjects = elements.filter(isObjectType).filter(isListCustomSettingsObject)
    const customSettingsObjectNames = await awu(customSettingsObjects)
      .map(customSetting => apiName(customSetting))
      .toArray()
    const customSettingsFetchSettings = await getCustomObjectsFetchSettings(
      customSettingsObjects,
      buildDataManagement({
        includeObjects: customSettingsObjectNames,
        saltoIDSettings: {
          defaultIdFields: ['Name'],
        },
      }),
    )
    const [validFetchSettings, invalidFetchSettings] = _.partition(
      customSettingsFetchSettings,
      setting => setting.invalidIdFields.length === 0,
    )
    await logInvalidCustomSettings(invalidFetchSettings)
    const customSettingsMap = await keyByAsync(validFetchSettings, obj => apiName(obj.objectType))
    const { instances, configChangeSuggestions } = await getAllInstances(client, customSettingsMap, config, false)
    elements.push(...instances)
    return {
      configSuggestions: [...configChangeSuggestions],
    }
  },
})

export default filterCreator
