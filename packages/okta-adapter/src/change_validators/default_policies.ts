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
import { ChangeValidator, getChangeData, isInstanceChange, isRemovalChange, InstanceElement, ChangeError, isRemovalOrModificationChange, Change } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ACTIVE_STATUS, INACTIVE_STATUS, POLICY_RULE_TYPE_NAMES, POLICY_TYPE_NAMES } from '../constants'

const { awu } = collections.asynciterable

const RELEVANT_POLICY_TYPES = new Set([...POLICY_TYPE_NAMES, ...POLICY_RULE_TYPE_NAMES])

const isRemovalOrDeactivationOfDefault = (change: Change<InstanceElement>): boolean => (
  getChangeData(change).value.system === true
    && (isRemovalChange(change) || getChangeData(change).value.status === INACTIVE_STATUS)
)

/**
 * Removal or deactivation of policy or policy rule is not allowed
 */
export const defaultPoliciesValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isRemovalOrModificationChange)
    .filter(change => RELEVANT_POLICY_TYPES.has(getChangeData(change).elemID.typeName))
    .filter(isRemovalOrDeactivationOfDefault)
    .map(getChangeData)
    .map((instance: InstanceElement): ChangeError => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot remove or deactivate default ${instance.elemID.typeName}`,
      detailedMessage: `Default ${instance.elemID.typeName} cannot be removed and must be in status ${ACTIVE_STATUS}`,
    }))
    .toArray()
)
