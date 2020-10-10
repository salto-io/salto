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
import { Element, isObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { isCustomSettingsObject, apiName } from '../transformers/transformer'
import { ConfigChangeSuggestion } from '../types'
import { getAllInstances } from './custom_objects_instances'

const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<ConfigChangeSuggestion[]> => {
    const customSettingsFetchSettings = elements.filter(obj => (isCustomSettingsObject(obj)
      && obj.annotations.customSettingsType === 'List'))
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
