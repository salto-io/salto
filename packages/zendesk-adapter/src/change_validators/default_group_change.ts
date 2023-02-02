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
import {
  ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionChange,
  isInstanceChange, isModificationChange, isRemovalChange,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { GROUP_TYPE_NAME } from '../constants'

const { isDefined } = lowerDashValues

const defaultGroupAdditionError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Warning',
  message: 'Cannot make changes of the default group',
  detailedMessage: 'TODO - talk with Tomer',
})

const defaultGroupRemovalError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Cannot make changes of the default group',
  detailedMessage: 'TODO - talk with Tomer',
})

const defaultGroupModificationError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error', // TODO: do we want to make the changes anyway and just warn the user?
  message: 'Cannot make changes of the default group',
  detailedMessage: 'TODO - talk with Tomer',
})

/**
 * Validates that the default group was not changed, and tell the user what to do
 */
export const defaultGroupChangeValidator: ChangeValidator = async changes => {
  const groupChanges = changes.filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_TYPE_NAME)

  const defaultGroupAddition = groupChanges.filter(isAdditionChange).find(change => getChangeData(change).value.default)
  const defaultGroupRemoval = groupChanges.filter(isRemovalChange).find(change => getChangeData(change).value.default)
  const defaultGroupModification = groupChanges.filter(isModificationChange).filter(change =>
    change.data.before.value.default !== change.data.after.value.default)

  return [
    defaultGroupAddition !== undefined ? defaultGroupAdditionError(getChangeData(defaultGroupAddition)) : undefined,
    defaultGroupRemoval !== undefined ? defaultGroupRemovalError(getChangeData(defaultGroupRemoval)) : undefined,
    defaultGroupModification.map(getChangeData).map(defaultGroupModificationError),
  ].filter(isDefined).flat()
}
