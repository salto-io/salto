/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  Change,
  CORE_ANNOTATIONS,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter_utils'
import { AdapterApiConfig } from '../config'
import { createUrl } from '../fetch/resource'

export const addUrlToInstance = (instance: InstanceElement, baseUrl: string, apiDefs: AdapterApiConfig): void => {
  const serviceUrl = apiDefs.types[instance.elemID.typeName]?.transformation?.serviceUrl
  if (serviceUrl === undefined) {
    return
  }
  // parent is ReferenceExpression during fetch, and serialized into full value during deploy
  const parentValues = instance.annotations[CORE_ANNOTATIONS.PARENT]?.map((parent: unknown) =>
    isReferenceExpression(parent) ? parent.value.value : parent,
  )
  const parentContext = parentValues?.reduce((result: Values, parentVal: Values, idx: number) => {
    Object.entries(parentVal).forEach(([key, value]) => {
      result[`_parent.${idx}.${key}`] = value
    })
    return result
  }, {})
  const url = createUrl({ instance, baseUrl: serviceUrl, additionalUrlVars: parentContext })
  instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, baseUrl).href
}

export const serviceUrlFilterCreator: <
  TClient,
  TContext extends { apiDefinitions: AdapterApiConfig },
  TResult extends void | filter.FilterResult = void,
>(
  baseUrl: string,
  additionalApiDefinitions?: AdapterApiConfig,
) => FilterCreator<TClient, TContext, TResult> =
  (baseUrl, additionalApiDefinitions) =>
  ({ config }) => ({
    name: 'serviceUrlFilter',
    onFetch: async (elements: Element[]) => {
      elements.filter(isInstanceElement).forEach(instance => {
        const apiDefinitions =
          additionalApiDefinitions?.types[instance.elemID.typeName] !== undefined
            ? additionalApiDefinitions
            : config.apiDefinitions
        addUrlToInstance(instance, baseUrl, apiDefinitions)
      })
    },
    onDeploy: async (changes: Change<InstanceElement>[]) => {
      const relevantChanges = changes.filter(isInstanceChange).filter(isAdditionChange)
      relevantChanges.map(getChangeData).forEach(instance => {
        const apiDefinitions =
          additionalApiDefinitions?.types[instance.elemID.typeName] !== undefined
            ? additionalApiDefinitions
            : config.apiDefinitions
        addUrlToInstance(instance, baseUrl, apiDefinitions)
      })
    },
  })
