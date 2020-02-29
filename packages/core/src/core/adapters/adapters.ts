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
  ObjectType, Adapter, ElemIdGetter, AdapterCreatorConfig,
} from '@salto-io/adapter-api'
import adapterCreators from './creators'

export const getAdaptersConfigType = (
  names: string[]
): Record<string, ObjectType> => {
  const relevantAdapterCreators = _.pick(adapterCreators, names)
  return _.mapValues(relevantAdapterCreators, creator => creator.configType)
}

export const initAdapters = (
  config: Record<string, AdapterCreatorConfig>,
  getElemIdFunc?: ElemIdGetter,
): Record<string, Adapter> =>
  _.mapValues(
    config, (conf, adapter) => {
      if (!conf.credentials) {
        throw new Error(`${adapter} is not logged in.\n\nPlease login and try again.`)
      }
      const creator = adapterCreators[adapter]
      if (!creator) {
        throw new Error(`${adapter} adapter is not registered.`)
      }
      return creator.create({
        config: conf,
        getElemIdFunc,
      })
    }
  )
