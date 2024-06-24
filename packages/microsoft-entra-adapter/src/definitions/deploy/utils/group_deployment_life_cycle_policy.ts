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

import _ from 'lodash'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { getChangeData, isModificationChange } from '@salto-io/adapter-api'
import { GROUP_LIFE_CYCLE_POLICY_FIELD_NAME, GROUP_TYPE_NAME } from '../../../constants'
import { EndpointPath } from '../../types'
import { DeployRequestDefinition, DeployableRequestDefinition } from '../types'

export const getGroupLifecyclePolicyGroupModificationRequest = (action: 'add' | 'remove'): DeployRequestDefinition => ({
  endpoint: {
    path: `/groupLifecyclePolicies/{lifeCyclePolicyId}/${action}Group` as EndpointPath,
    method: 'post',
  },
  transformation: {
    pick: ['id'],
    adjust: ({ value }) => {
      validatePlainObject(value, GROUP_TYPE_NAME)
      return {
        value: {
          groupId: value.id,
        },
      }
    },
  },
  context: {
    custom:
      () =>
      ({ change }) => {
        const dataWithPolicyId =
          action === 'remove' && isModificationChange(change) ? change.data.before.value : getChangeData(change).value
        return {
          lifeCyclePolicyId: _.get(dataWithPolicyId, `${GROUP_LIFE_CYCLE_POLICY_FIELD_NAME}.resValue.value.id`),
        }
      },
  },
})

export const createDefinitionForGroupLifecyclePolicyGroupModification = (
  action: 'add' | 'remove',
): DeployableRequestDefinition => ({
  request: getGroupLifecyclePolicyGroupModificationRequest(action),
  condition: {
    custom:
      () =>
      ({ change }) => {
        if (!isModificationChange(change)) {
          return false
        }
        const hadGroupLifecyclePolicy = !_.isEmpty(change.data.before.value[GROUP_LIFE_CYCLE_POLICY_FIELD_NAME])
        const hasGroupLifecyclePolicy = !_.isEmpty(change.data.after.value[GROUP_LIFE_CYCLE_POLICY_FIELD_NAME])
        return action === 'add'
          ? !hadGroupLifecyclePolicy && hasGroupLifecyclePolicy
          : hadGroupLifecyclePolicy && !hasGroupLifecyclePolicy
      },
  },
})
