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
import { Element, isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { isCustomSettingsObject, apiName } from '../transformers/transformer'
import { ConfigChangeSuggestion } from '../types'
import { getAllInstances } from './custom_objects_instances'
import { CUSTOM_SETTINGS_TYPE, LIST_CUSTOM_SETTINGS_TYPE } from '../constants'

export const isListCustomSettingsObject = (obj: ObjectType):
  boolean => (isCustomSettingsObject(obj)
    && obj.annotations[CUSTOM_SETTINGS_TYPE] === LIST_CUSTOM_SETTINGS_TYPE)

const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<ConfigChangeSuggestion[]> => {
    const customSettingsFetchSettings = elements.filter(obj => isObjectType(obj)
    && isListCustomSettingsObject(obj))
      .filter(isObjectType)
      .map(objectType => ({
        isBase: true,
        objectType,
        idFields: [objectType.fields.Name],
      }))
    const customSettingsMap = _.keyBy(customSettingsFetchSettings, obj => apiName(obj.objectType))
    const { instances, configChangeSuggestions } = await getAllInstances(client, customSettingsMap)
    elements.push(...instances)
    return [...configChangeSuggestions]
  },
})

export default filterCreator
