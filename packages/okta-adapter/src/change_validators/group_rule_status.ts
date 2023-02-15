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
import { ChangeValidator, getChangeData, isInstanceChange, InstanceElement, ChangeError, isModificationChange, Change, isRemovalChange, isAdditionChange } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { GROUP_RULE_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable
const ACTIVE_STATUS = 'ACTIVE'
const INVALID_STATUS = 'INVALID'
const INACTIVE_STATUS = 'INACTIVE'

const getGroupRuleStatusError = (
  change: Change<InstanceElement>
): ChangeError | undefined => {
  const instance = getChangeData(change)
  if (isRemovalChange(change) && instance.value.status === ACTIVE_STATUS) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot remove ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}`,
      detailedMessage: `Cannot remove ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}. Please change instance status to ${INACTIVE_STATUS} and try again.`,
    }
  }
  if (isModificationChange(change)) {
    const { before, after } = change.data
    if (before.value.status !== after.value.status) {
      // TODO remove after SALTO-3591
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot modify ${GROUP_RULE_TYPE_NAME} status`,
        detailedMessage: `Cannot modify ${GROUP_RULE_TYPE_NAME} status, please make this change in Okta.`,
      }
    }
    if (before.value.status === ACTIVE_STATUS) {
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}`,
        detailedMessage: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}. Please change instance status to ${INACTIVE_STATUS} and try again.`,
      }
    }
    if (before.value.status === INVALID_STATUS) {
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ${INVALID_STATUS}`,
        detailedMessage: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ${INVALID_STATUS}. You can remove this instance and create a new one.`,
      }
    }
  }
  if (isAdditionChange(change)) {
    // TODO remove after SALTO-3591
    if (instance.value.status === ACTIVE_STATUS) {
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot add ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}`,
        detailedMessage: `${GROUP_RULE_TYPE_NAME} must be created with status ${INACTIVE_STATUS}`,
      }
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
    .filter(change => getChangeData(change).elemID.typeName === GROUP_RULE_TYPE_NAME)
    .map(getGroupRuleStatusError)
    .filter(values.isDefined)
    .toArray()
)
