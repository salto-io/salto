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
  Adapter, AdapterAuthentication, Element, ReadOnlyElementsSource, GLOBAL_ADAPTER, ObjectType,
} from '@salto-io/adapter-api'
import { createDefaultInstanceFromType, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { merger } from '@salto-io/workspace'
import { values } from '@salto-io/lowerdash'
import { elements } from '@salto-io/adapter-components'
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

const getAdapterConfigFromType = async (
  adapterName: string
): Promise<InstanceElement | undefined> => {
  const { configType } = adapterCreators[adapterName]
  return configType ? createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType) : undefined
}

export const getAdaptersConfigTypes = async (): Promise<ObjectType[]> => {
  const types = Object.values(adapterCreators)
    .map(adapterCreator => adapterCreator.configType)
    .filter(values.isDefined)
  return [...types, ...await elements.subtypes.getSubtypes(types)]
}

export const getDefaultAdapterConfig = async (
  adapterName: string
): Promise<InstanceElement[] | undefined> => {
  const { getDefaultConfig } = adapterCreators[adapterName]
  if (getDefaultConfig !== undefined) {
    return getDefaultConfig()
  }

  const defaultConf = await getAdapterConfigFromType(adapterName)
  return defaultConf && [defaultConf]
}

const getMergedDefaultAdapterConfig = async (
  adapter: string
): Promise<InstanceElement | undefined> => {
  const defaultConfig = await getDefaultAdapterConfig(adapter)
  return defaultConfig && merger.mergeSingleElement(defaultConfig)
}

const filterElementsSourceAdapter = (
  elementsSource: ReadOnlyElementsSource,
  adapter: string
): ReadOnlyElementsSource => {
  const isRelevantID = (elemID: ElemID): boolean =>
    (elemID.adapter === adapter || elemID.adapter === GLOBAL_ADAPTER)
  return {
    getAll: async () => {
      async function *getElements(): AsyncIterable<Element> {
        for await (const element of await elementsSource.getAll()) {
          if (isRelevantID(element.elemID)) {
            yield element
          }
        }
      }
      return getElements()
    },
    get: async id => (isRelevantID(id) ? elementsSource.get(id) : undefined),
    list: async () => {
      async function *getIds(): AsyncIterable<ElemID> {
        for await (const element of await elementsSource.getAll()) {
          if (isRelevantID(element.elemID)) {
            yield element.elemID
          }
        }
      }
      return getIds()
    },
    has: async id => (isRelevantID(id) ? elementsSource.has(id) : false),
  }
}

type AdapterConfigGetter = (
  adapter: string, defaultValue?: InstanceElement
) => Promise<InstanceElement | undefined>

export const getAdaptersCreatorConfigs = async (
  adapters: ReadonlyArray<string>,
  credentials: Readonly<Record<string, InstanceElement>>,
  getConfig: AdapterConfigGetter,
  elementsSource: ReadOnlyElementsSource,
  elemIdGetter?: ElemIdGetter,
): Promise<Record<string, AdapterOperationsContext>> => (
  Object.fromEntries(await Promise.all(adapters.map(
    async adapter => [
      adapter,
      {
        credentials: credentials[adapter],
        config: await getConfig(adapter, await getMergedDefaultAdapterConfig(adapter)),
        elementsSource: filterElementsSourceAdapter(elementsSource, adapter),
        getElemIdFunc: elemIdGetter,
      },
    ]
  )))
)

export const getAdapters = async (
  adapters: ReadonlyArray<string>,
  credentials: Readonly<Record<string, InstanceElement>>,
  getConfig: AdapterConfigGetter,
  workspaceElementsSource: ReadOnlyElementsSource,
  elemIdGetter?: ElemIdGetter,
): Promise<Record<string, AdapterOperations>> =>
  initAdapters(await getAdaptersCreatorConfigs(
    adapters,
    credentials,
    getConfig,
    workspaceElementsSource,
    elemIdGetter
  ))
