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

import { deployment } from '@salto-io/adapter-components'
import { isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import {
  DEPLOY_USING_RLM_GROUP,
  RLM_DEPLOY_SUPPORTED_TYPES,
} from './constants'
import { isFromType } from './utils'


export const getRLMGroupId: deployment.ChangeIdFunction = async change => (
  (isAdditionOrModificationChange(change)
    && isInstanceChange(change)
    && isFromType(RLM_DEPLOY_SUPPORTED_TYPES)(change))
    ? DEPLOY_USING_RLM_GROUP : undefined
)

export const getChangeGroupIds = deployment.getChangeGroupIdsFunc([
  getRLMGroupId,
])
