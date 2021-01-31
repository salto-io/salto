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
import { Element, isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { isCustomSettingsObject, apiName } from '../transformers/transformer'
import { ConfigChangeSuggestion } from '../types'
import { getAllInstances, getCustomObjectsFetchSettings, CustomObjectFetchSetting } from './custom_objects_instances'
import { CUSTOM_SETTINGS_TYPE, LIST_CUSTOM_SETTINGS_TYPE } from '../constants'
import { buildDataManagement } from '../fetch_profile/data_management'

const log = logger(module)

export const isListCustomSettingsObject = (obj: ObjectType):
  boolean => (isCustomSettingsObject(obj)
    && obj.annotations[CUSTOM_SETTINGS_TYPE] === LIST_CUSTOM_SETTINGS_TYPE)

const logInvalidCustomSettings = (invalidCustomSettings: CustomObjectFetchSetting[]): void => (
  invalidCustomSettings.forEach(settings =>
    (log.debug(`Did not fetch instances for Custom Setting - ${apiName(settings.objectType)} cause ${settings.invalidIdFields} do not exist or are not queryable`)))
)

const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<ConfigChangeSuggestion[]> => {
    const customSettingsObjects = elements
      .filter(isObjectType)
      .filter(isListCustomSettingsObject)
    const customSettingsObjectNames = customSettingsObjects
      .map(customSetting => apiName(customSetting))
    const customSettingsFetchSettings = getCustomObjectsFetchSettings(
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
      setting => setting.invalidIdFields === undefined
    )
    logInvalidCustomSettings(invalidFetchSettings)
    const customSettingsMap = _.keyBy(validFetchSettings, obj => apiName(obj.objectType))
    const { instances, configChangeSuggestions } = await getAllInstances(client, customSettingsMap)
    elements.push(...instances)
    return [...configChangeSuggestions]
  },
})

export default filterCreator
