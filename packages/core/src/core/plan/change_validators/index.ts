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

import { AdapterOperations, ChangeValidator, InstanceElement } from '@salto-io/adapter-api'
import { createChangeValidator } from '@salto-io/adapter-utils'
import { promises } from '@salto-io/lowerdash'
import _ from 'lodash'
import { getAdapterChangeValidators, AdapterConfigGetter } from '../../adapters'
import { changeValidator as unresolvedReferencesValidator } from './unresolved_references'
import { checkDeploymentAnnotationsValidator } from './check_deployment_annotations'


const { mapValuesAsync } = promises.object

const DEFAULT_CHANGE_VALIDATORS = [
  unresolvedReferencesValidator,
  checkDeploymentAnnotationsValidator,
]

const getChangeValidators = (adapters: Record<string, AdapterOperations>):
Record<string, ChangeValidator> =>
  _.mapValues(
    getAdapterChangeValidators(adapters),
    adapterValidator => createChangeValidator([...DEFAULT_CHANGE_VALIDATORS, adapterValidator])
  )

const getAdaptersConfig = async (
  adapters: Record<string, AdapterOperations>,
  getConfig: AdapterConfigGetter,
): Promise<Record<string, InstanceElement | undefined>> => {
  const adaptersConfig = await mapValuesAsync(
    adapters,
    (_v, adapter) => getConfig(adapter)
  )

  return adaptersConfig
}

export {
  getChangeValidators,
  getAdaptersConfig,
}
