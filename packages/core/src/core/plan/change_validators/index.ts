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

import { AdapterOperations, ChangeValidator } from '@salto-io/adapter-api'
import { createChangeValidator } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { getAdapterChangeValidators } from '../../adapters'
import { checkDeploymentAnnotationsValidator } from './check_deployment_annotations'


const DEFAULT_CHANGE_VALIDATORS = [
  checkDeploymentAnnotationsValidator,
]

const getChangeValidators = (adapters: Record<string, AdapterOperations>, checkOnly: boolean):
Record<string, ChangeValidator> =>
  _.mapValues(
    getAdapterChangeValidators(adapters, checkOnly),
    adapterValidator => createChangeValidator([...DEFAULT_CHANGE_VALIDATORS, adapterValidator])
  )

export default getChangeValidators
