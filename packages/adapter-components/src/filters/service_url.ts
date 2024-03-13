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
  ActionName,
  Change,
  CORE_ANNOTATIONS,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  ReadOnlyElementsSource,
  Values,
} from '@salto-io/adapter-api'
import { filter } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { AdapterFilterCreator, FilterCreator } from '../filter_utils'
import { createUrl } from '../fetch/resource'
import { ApiDefinitions, queryWithDefault } from '../definitions'
import { InstanceFetchApiDefinitions } from '../definitions/system/fetch'
import { AdapterApiConfig, TransformationConfig, TypeConfig } from '../config'

const log = logger(module)

export const transformConfigToFetchDefinitionsForServiceUrl = (
  configDef?: TypeConfig<TransformationConfig, ActionName>,
  additionalConfigDef?: TypeConfig<TransformationConfig, ActionName>,
): InstanceFetchApiDefinitions => {
  const serviceUrl = additionalConfigDef?.transformation?.serviceUrl ?? configDef?.transformation?.serviceUrl
  return {
    element: {
      topLevel: {
        isTopLevel: true as const,
        serviceUrl: serviceUrl ? { path: serviceUrl } : undefined,
      },
    },
  }
}

export const addUrlToInstance: <ClientOptions extends string = 'main'>(
  instance: InstanceElement,
  baseUrl: string,
  apiDef: InstanceFetchApiDefinitions<ClientOptions> | undefined,
) => void = (instance, baseUrl, apiDef) => {
  const serviceUrl = apiDef?.element?.topLevel?.serviceUrl
  if (serviceUrl === undefined) {
    return
  }
  // TODO_F use custom function from serviceUrl SALTO-5580
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
  const url = createUrl({ instance, url: serviceUrl.path, additionalUrlVars: parentContext })
  instance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, baseUrl).href
}

export const serviceUrlFilterCreator: <
  TContext,
  TResult extends void | filter.FilterResult = void,
  TAdditional = {},
  ClientOptions extends string = 'main',
  PaginationOptions extends string | 'none' = 'none',
  Action extends string = ActionName,
>(
  baseUrl: string,
) => AdapterFilterCreator<TContext, TResult, TAdditional, ClientOptions, PaginationOptions, Action> =
  baseUrl =>
  ({ definitions }) => {
    if (definitions.fetch === undefined) {
      log.warn('No fetch definitions were found, skipping service url filter')
      return () => ({})
    }
    const { instances } = definitions.fetch
    const defQuery = queryWithDefault(instances)
    return {
      name: 'serviceUrlFilter',
      onFetch: async (elements: Element[]) => {
        elements.filter(isInstanceElement).forEach(instance => {
          addUrlToInstance(instance, baseUrl, defQuery.query(instance.elemID.typeName))
        })
      },
      onDeploy: async (changes: Change<InstanceElement>[]) => {
        const relevantChanges = changes.filter(isInstanceChange).filter(isAdditionChange)
        relevantChanges.map(getChangeData).forEach(instance => {
          addUrlToInstance(instance, baseUrl, defQuery.query(instance.elemID.typeName))
        })
      },
    }
  }
// TODO deprecate when upgrading to new definitions SALTO-5538
export const serviceUrlFilterCreatorDeprecated: <
  TClient,
  TContext extends { apiDefinitions: AdapterApiConfig },
  TResult extends void | filter.FilterResult = void,
>(
  baseUrl: string,
  additionalApiDefinitions?: AdapterApiConfig,
) => FilterCreator<TClient, TContext, TResult> = (baseUrl, additionalApiDefinitions) => args => {
  const { config } = args
  const typeNamesSet = new Set([...Object.keys(config.apiDefinitions.types), ...Object.keys(additionalApiDefinitions?.types ?? {})])
  const customizations = Object.fromEntries(
    Array.from(typeNamesSet).map(typeName => ([
      typeName,
      transformConfigToFetchDefinitionsForServiceUrl(config.apiDefinitions.types[typeName], additionalApiDefinitions?.types[typeName]),
    ])),
  )

  const definitions = {
    fetch: {
      instances: {
        customizations,
      },
    },
  } as ApiDefinitions
  return serviceUrlFilterCreator(baseUrl)({ ...args, definitions, elementSource: {} as ReadOnlyElementsSource })
}
