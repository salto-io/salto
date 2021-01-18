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
import _ from 'lodash'
import {
  AdapterOperations, ElemIdGetter, AdapterOperationsContext, ElemID, InstanceElement,
  Adapter, AdapterAuthentication, Element, ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { createDefaultInstanceFromType, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import adapterCreators from './creators'

const log = logger(module)

export const getAdaptersCredentialsTypes = (
  names?: ReadonlyArray<string>
): Record<string, AdapterAuthentication> => {
  let relevantAdapterCreators: Record<string, Adapter>
  if (names === undefined) {
    relevantAdapterCreators = adapterCreators
  } else {
    const nonExistingAdapters = names.filter(name => !Object.keys(adapterCreators).includes(name))
    if (!_.isEmpty(nonExistingAdapters)) {
      throw new Error(`No adapter available for ${nonExistingAdapters}`)
    }
    relevantAdapterCreators = _.pick(adapterCreators, names)
  }
  return _.mapValues(relevantAdapterCreators, creator => creator.authenticationMethods)
}

export const initAdapters = (
  config: Record<string, AdapterOperationsContext>,
): Record<string, AdapterOperations> =>
  _.mapValues(
    config, (context, adapter) => {
      if (!context.credentials) {
        throw new Error(`${adapter} is not logged in.\n\nPlease login and try again.`)
      }
      const creator = adapterCreators[adapter]
      if (!creator) {
        throw new Error(`${adapter} adapter is not registered.`)
      }
      log.debug('Using the following config for %s adapter: %s', adapter, safeJsonStringify(context.config?.value, undefined, 2))
      return creator.operations(context)
    }
  )

export const getDefaultAdapterConfig = (adapterName: string): InstanceElement | undefined => {
  const { configType } = adapterCreators[adapterName]
  return configType ? createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType) : undefined
}

const filterElementsSourceAdapter = (
  elementsSource: ReadOnlyElementsSource,
  adapter: string
): ReadOnlyElementsSource => ({
  getAll: async () => {
    async function *getElements(): AsyncIterable<Element> {
      for await (const element of await elementsSource.getAll()) {
        if (element.elemID.adapter === adapter) {
          yield element
        }
      }
    }
    return getElements()
  },
  get: async id => (id.adapter === adapter ? elementsSource.get(id) : undefined),
  list: async () => {
    async function *getIds(): AsyncIterable<ElemID> {
      for await (const element of await elementsSource.getAll()) {
        if (element.elemID.adapter === adapter) {
          yield element.elemID
        }
      }
    }
    return getIds()
  },
  has: async id => (id.adapter === adapter ? elementsSource.has(id) : false),
})

export const getAdaptersCreatorConfigs = async (
  adapters: ReadonlyArray<string>,
  credentials: Readonly<Record<string, InstanceElement>>,
  config: Readonly<Record<string, InstanceElement>>,
  workspaceElementsSource: ReadOnlyElementsSource,
  elemIdGetter?: ElemIdGetter,
): Promise<Record<string, AdapterOperationsContext>> => (
  _.fromPairs(await Promise.all(adapters.map(
    async adapter => {
      const adapterConfig = config[adapter]
      return ([adapter, {
        credentials: credentials[adapter],
        config: adapterConfig ?? getDefaultAdapterConfig(adapter),
        elementsSource: filterElementsSourceAdapter(workspaceElementsSource, adapter),
        getElemIdFunc: elemIdGetter,
      }])
    }
  )))
)

export const getAdapters = async (
  adapters: ReadonlyArray<string>,
  credentials: Readonly<Record<string, InstanceElement>>,
  config: Readonly<Record<string, InstanceElement>>,
  workspaceElementsSource: ReadOnlyElementsSource,
  elemIdGetter?: ElemIdGetter,
): Promise<Record<string, AdapterOperations>> =>
  initAdapters(await getAdaptersCreatorConfigs(
    adapters,
    credentials,
    config,
    workspaceElementsSource,
    elemIdGetter
  ))
