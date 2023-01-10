/*
*                      Copyright 2022 Salto Labs Ltd.
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
  Change,
  ChangeValidator, getChangeData, isAdditionOrModificationChange,
  isInstanceChange, isRemovalChange,
} from '@salto-io/adapter-api'
import { GROUP_TYPE_NAME } from '../constants'

// Check if there was any change that marked a new default group
const isThereNewDefaultGroup = (changes: Change[]): boolean =>
  changes.filter(isInstanceChange).filter(isAdditionOrModificationChange).map(getChangeData)
    .some(group => group.value.default === true)

/**
 * Validates the default group is not deleted, unless another group becomes the default
 * There is a filter that runs modifications before removals (so change of default group will run before deletion)
 */
export const defaultGroupDeletion: ChangeValidator = async changes => {
  const groupChanges = changes.filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_TYPE_NAME)

  const defaultGroupRemoval = groupChanges.filter(isRemovalChange).map(getChangeData)
    .find(group => group.value.default === true)

  // If there is no new default group and the previous one is removed, create an error
  return isThereNewDefaultGroup(groupChanges) || defaultGroupRemoval === undefined
    ? [] : [{
      elemID: defaultGroupRemoval.elemID,
      severity: 'Error',
      message: 'Default group cannot be deleted',
      detailedMessage: `Group '${defaultGroupRemoval.elemID.name}' is marked as default and therefore cannot be deleted`,
    }]
}
