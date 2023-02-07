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
import { Change, CORE_ANNOTATIONS, Element, getChangeData, InstanceElement, isAdditionChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter_utils'
import { createUrl } from '../elements'
import { AdapterApiConfig } from '../config'


export const addUrlToInstance = <TContext extends { apiDefinitions: AdapterApiConfig }>(
  instance: InstanceElement, baseUrl: string, config: TContext
): void => {
  const serviceUrl = config.apiDefinitions
    .types[instance.elemID.typeName]?.transformation?.serviceUrl
  if (serviceUrl === undefined) {
    return
  }
  const url = createUrl({ instance, baseUrl: serviceUrl })
  instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = (new URL(url, baseUrl)).href
}

export const serviceUrlFilterCreator: <
  TClient,
  TContext extends { apiDefinitions: AdapterApiConfig },
  TResult extends void | filter.FilterResult = void
>(baseUrl: string) => FilterCreator<TClient, TContext, TResult> = baseUrl => ({ config }) => ({
  name: 'serviceUrlFilter',
  onFetch: async (elements: Element[]) => {
    elements
      .filter(isInstanceElement)
      .forEach(instance => addUrlToInstance(instance, baseUrl, config))
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    const relevantChanges = changes.filter(isInstanceChange).filter(isAdditionChange)
    relevantChanges
      .map(getChangeData)
      .forEach(instance => addUrlToInstance(instance, baseUrl, config))
  },
})
