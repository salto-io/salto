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
import { Change, CORE_ANNOTATIONS, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { getParent } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { JiraConfig } from '../config/config'
import JiraClient from '../client/client'
import { JSM_SUPPORTED_TYPES } from './jsm_types_fetch_filter'

const addUrlToInstance = (instance: InstanceElement, clinet: JiraClient, config: JiraConfig): void => {
  const serviceUrl = config.jsmApiDefinitions?.types[instance.elemID.typeName]?.transformation?.serviceUrl
  if (serviceUrl === undefined) {
    return
  }
  const additionalUrlVars: Record<string, string> = {
    projectKey: getParent(instance).value.key,
  }
  const url = elementUtils.createUrl({ instance, baseUrl: serviceUrl, additionalUrlVars })
  instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = (new URL(url, clinet.baseUrl)).href
}

const filterCreator: FilterCreator = ({ config, client }) => ({
  name: 'jsmServiceUrlFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(e => JSM_SUPPORTED_TYPES.includes(e.elemID.typeName))
      .forEach(instance => addUrlToInstance(instance, client, config))
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    const relevantChanges = changes
      .filter(change => JSM_SUPPORTED_TYPES.includes(getChangeData(change).elemID.typeName))
      .filter(isInstanceChange)
      .filter(isAdditionChange)
    relevantChanges
      .map(getChangeData)
      .forEach(instance => addUrlToInstance(instance, client, config))
  },
})

export default filterCreator
