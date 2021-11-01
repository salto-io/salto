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
  ServiceIds,
} from '@salto-io/adapter-api'
import { createDefaultInstanceFromType, safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { createAdapterReplacedID, merger, updateElementsWithAlternativeAdapter } from '@salto-io/workspace'
import { values, collections } from '@salto-io/lowerdash'
import { elements } from '@salto-io/adapter-components'
import adapterCreators from './creators'

const { awu } = collections.asynciterable
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
  accountIDToServiceNameMap: Record<string, string> = {},
): Record<string, AdapterOperations> =>
  _.mapValues(
    config, (context, adapter) => {
      if (!context.credentials) {
        throw new Error(`${adapter} is not logged in.\n\nPlease login and try again.`)
      }
      const creator = adapterCreators[accountIDToServiceNameMap[adapter] ?? adapter]
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
  adapterName: string,
  accountName: string,
): Promise<InstanceElement[] | undefined> => {
  const { getDefaultConfig } = adapterCreators[adapterName]
  let defaultConf: InstanceElement[] | undefined
  if (getDefaultConfig !== undefined) {
    defaultConf = await getDefaultConfig()
  } else {
    const adapterConf = await getAdapterConfigFromType(adapterName)
    defaultConf = adapterConf && [adapterConf]
  }
  if (defaultConf && adapterName !== accountName) {
    defaultConf = _.cloneDeep(defaultConf)
    defaultConf = defaultConf.map(conf => conf.clone())
    await updateElementsWithAlternativeAdapter(defaultConf, accountName, adapterName)
  }
  return defaultConf
}

const getMergedDefaultAdapterConfig = async (
  adapter: string,
  accountName: string,
): Promise<InstanceElement | undefined> => {
  const defaultConfig = await getDefaultAdapterConfig(adapter, accountName)
  return defaultConfig && merger.mergeSingleElement(defaultConfig)
}

export const createElemIDReplacedElementsSource = (
  elementsSource: ReadOnlyElementsSource,
  account: string,
  adapter: string,
): ReadOnlyElementsSource => ({
  getAll: async () => {
    if (account !== adapter) {
      const sourceElements = await awu(await elementsSource.getAll()).toArray()
      await updateElementsWithAlternativeAdapter(sourceElements, adapter, account, elementsSource)
      return awu(sourceElements)
    }
    return elementsSource.getAll()
  },
  get: async id => {
    if (account !== adapter) {
      if (id.adapter !== adapter) {
        return undefined
      }
      const element = await elementsSource.get(createAdapterReplacedID(id, account))
      if (element) {
        await updateElementsWithAlternativeAdapter([element], adapter, account, elementsSource)
      }
      return element
    }
    return elementsSource.get(id)
  },
  list: async () =>
    awu(await elementsSource.list()).map(id => createAdapterReplacedID(id, adapter)),
  has: async id => {
    if (id.adapter !== adapter) {
      return false
    }
    const transformedId = createAdapterReplacedID(id, account)
    return elementsSource.has(transformedId)
  },
})

const filterElementsSource = (
  elementsSource: ReadOnlyElementsSource,
  adapterName: string,
): ReadOnlyElementsSource => {
  const isRelevantID = (elemID: ElemID): boolean =>
    (elemID.adapter === adapterName || elemID.adapter === GLOBAL_ADAPTER)
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
      return awu(getIds())
    },
    has: async id => elementsSource.has(id),
  }
}

export type AdapterConfigGetter = (
  adapter: string, defaultValue?: InstanceElement
) => Promise<InstanceElement | undefined>

export const getAdaptersCreatorConfigs = async (
  accounts: ReadonlyArray<string>,
  credentials: Readonly<Record<string, InstanceElement>>,
  getConfig: AdapterConfigGetter,
  elementsSource: ReadOnlyElementsSource,
  accountIDToServiceName: Record<string, string>,
  elemIdGetters: Record<string, ElemIdGetter> = {},
): Promise<Record<string, AdapterOperationsContext>> => (
  Object.fromEntries(await Promise.all(accounts.map(
    async account => {
      const defaultConfig = await getMergedDefaultAdapterConfig(accountIDToServiceName[account],
        account)
      if (defaultConfig && account !== accountIDToServiceName[account]) {
        await updateElementsWithAlternativeAdapter(
          [defaultConfig],
          account,
          accountIDToServiceName[account],
          elementsSource,
        )
      }
      return [
        account,
        {
          credentials: credentials[account],
          config: await getConfig(account, defaultConfig),
          elementsSource: createElemIDReplacedElementsSource(filterElementsSource(
            elementsSource, accountIDToServiceName[account]
          ), account, accountIDToServiceName[account]),
          getElemIdFunc: (elemIdGetters[account]
            ? ((adapterIds: string, serviceIds: ServiceIds,
              name: string) => createAdapterReplacedID(elemIdGetters[account](
              adapterIds, serviceIds, name,
            ), accountIDToServiceName[account])) : undefined),
        },
      ]
    }
  )))
)

export const getAdapters = async (
  adapters: ReadonlyArray<string>,
  credentials: Readonly<Record<string, InstanceElement>>,
  getConfig: AdapterConfigGetter,
  workspaceElementsSource: ReadOnlyElementsSource,
  accountIDToServiceName: Record<string, string>,
  elemIdGetters: Record<string, ElemIdGetter> = {},
): Promise<Record<string, AdapterOperations>> =>
  initAdapters(await getAdaptersCreatorConfigs(
    adapters,
    credentials,
    getConfig,
    workspaceElementsSource,
    accountIDToServiceName,
    elemIdGetters
  ), accountIDToServiceName)
