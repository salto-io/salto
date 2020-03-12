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
import _ from 'lodash'
import {
  ObjectType, Adapter, ElemIdGetter, AdapterCreatorOpts, ElemID, InstanceElement,
} from '@salto-io/adapter-api'
import adapterCreators from './creators'
import { ConfigSource } from '../../workspace/config_source'
import { createDefaultInstanceFromType } from '../merger/internal/instances'

export const getAdaptersCredentialsTypes = (
  names: string[]
): Record<string, ObjectType> => {
  const relevantAdapterCreators = _.pick(adapterCreators, names)
  return _.mapValues(relevantAdapterCreators, creator => creator.credentialsType)
}

export const initAdapters = (
  config: Record<string, AdapterCreatorOpts>,
): Record<string, Adapter> =>
  _.mapValues(
    config, (opts, adapter) => {
      if (!opts.credentials) {
        throw new Error(`${adapter} is not logged in.\n\nPlease login and try again.`)
      }
      const creator = adapterCreators[adapter]
      if (!creator) {
        throw new Error(`${adapter} adapter is not registered.`)
      }
      return creator.create(opts)
    }
  )

const getDefaultAdapterConfig = (adapterName: string): InstanceElement | undefined => {
  const { configType } = adapterCreators[adapterName]
  return configType ? createDefaultInstanceFromType(ElemID.CONFIG_NAME, configType) : undefined
}

export const createDefaultAdapterConfig = async (adapterName: string, config: ConfigSource):
Promise<InstanceElement | undefined> => {
  const adapterConfig = await config.get(adapterName)
  const defaultConfig = getDefaultAdapterConfig(adapterName)
  if (_.isUndefined(adapterConfig) && defaultConfig) {
    await config.set(adapterName, defaultConfig)
  }
  return adapterConfig ?? defaultConfig
}

export const getAdapters = async (
  adapters: string[],
  credentials: ConfigSource,
  config: ConfigSource,
  elemIdGetter?: ElemIdGetter,
): Promise<Record<string, Adapter>> => {
  const creatorConfig: Record<string, AdapterCreatorOpts> = _
    .fromPairs(await Promise.all(adapters.map(
      async adapter => {
        const adapterConfig = await config.get(adapter)
        return ([adapter, {
          credentials: await credentials.get(adapter),
          config: adapterConfig ?? getDefaultAdapterConfig(adapter),
          getElemIdFunc: elemIdGetter,
        }])
      }
    )))
  return initAdapters(creatorConfig)
}
