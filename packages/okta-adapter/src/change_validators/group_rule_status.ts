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
import { ChangeValidator, getChangeData, isInstanceChange, InstanceElement, ChangeError, isAdditionOrModificationChange, isModificationChange, AdditionChange, ModificationChange } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { GROUP_RULE_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const ACTIVE_STATUS = 'ACTIVE'
const INVALID_STATUS = 'INVALID'
const INACTIVE_STATUS = 'INACTIVE'

const getGroupRuleStatusError = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
): ChangeError | undefined => {
  const instance = getChangeData(change)
  if (isModificationChange(change)) {
    const { before, after } = change.data
    if (before.value.status === INVALID_STATUS) {
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot change group rule with status ${INVALID_STATUS}`,
        detailedMessage: `Cannot deploy group rule: ${instance.elemID.name}, because group rules with status ${INVALID_STATUS} can not be changed`,
      }
    }
    if (before.value.status !== after.value.status) {
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Cannot change status of group rule',
        detailedMessage: `Cannot deploy group rule: ${instance.elemID.name}, because group rule status cannot be changed using salto`,
      }
    }
  }
  // AdditionChange
  if (instance.value.status === ACTIVE_STATUS) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot add group rule with status ${ACTIVE_STATUS}`,
      detailedMessage: `Cannot deploy group rule: ${instance.elemID.name}, group rule status must be set to ${INACTIVE_STATUS} when created`,
    }
  }
  return undefined
}
/**
 * Validate GroupRule status before deployment
 */
export const groupRuleStatusValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_RULE_TYPE_NAME)
    .map(getGroupRuleStatusError)
    .filter(values.isDefined)
    .toArray()
)
