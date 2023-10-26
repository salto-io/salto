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
import { Change, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { filters } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { JSM_DUCKTYPE_SUPPORTED_TYPES } from '../config/api_config'

const log = logger(module)
const { addUrlToInstance } = filters

const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'jsmServiceUrlFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    const { jsmApiDefinitions } = config
    if (jsmApiDefinitions === undefined) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(e => Object.keys(JSM_DUCKTYPE_SUPPORTED_TYPES).includes(e.elemID.typeName))
      .forEach(instance => {
        try {
          addUrlToInstance(instance, client.baseUrl, jsmApiDefinitions)
        } catch (e) {
          log.warn(`Failed to add service url to ${instance.elemID.getFullName()}: ${e}`)
        }
      })
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    if (!config.fetch.enableJSM) {
      return
    }
    const { jsmApiDefinitions } = config
    if (jsmApiDefinitions === undefined) {
      return
    }
    const relevantChanges = changes
      .filter(change => Object.keys(JSM_DUCKTYPE_SUPPORTED_TYPES).includes(getChangeData(change).elemID.typeName))
      .filter(isInstanceChange)
      .filter(isAdditionChange)
    relevantChanges
      .map(getChangeData)
      .forEach(instance => {
        try {
          addUrlToInstance(instance, client.baseUrl, jsmApiDefinitions)
        } catch (e) {
          log.warn(`Failed to add service url to ${instance.elemID.getFullName()}: ${e}`)
        }
      })
  },
})

export default filterCreator
