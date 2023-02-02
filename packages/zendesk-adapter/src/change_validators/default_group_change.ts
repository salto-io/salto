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
import { GROUP_TYPE_NAME } from '../constants'

const API_ERROR_MESSAGE = 'Changing the default group is not supported via the Zendesk API'

const defaultGroupAdditionError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Cannot add a new default group',
  detailedMessage: `${API_ERROR_MESSAGE}, once deployed, you will need to set the group as default directly via Zendesk and fetch`,
})

const defaultGroupRemovalError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Cannot delete the default group',
  detailedMessage: `This group (${group.elemID.name}) is currently set as default in Zendesk and therefore cannot be deleted.
${API_ERROR_MESSAGE}, therefore, you will need to configure a new default group directly via Zendesk and fetch.`,
})

const defaultGroupModificationError = (group: InstanceElement): ChangeError => ({
  elemID: group.elemID,
  severity: 'Error',
  message: 'Cannot change the default group',
  detailedMessage: `${API_ERROR_MESSAGE}, therefore, you will need to do it directly via Zendesk and fetch.`,
})

/**
 * Validates that the default group was not changed, and tell the user what to do
 */
export const defaultGroupChangeValidator: ChangeValidator = async changes => {
  const groupChanges = changes.filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_TYPE_NAME)

  const defaultGroupAddition = groupChanges.filter(isAdditionChange).map(getChangeData)
    .filter(group => group.value.default === true)
  const defaultGroupRemoval = groupChanges.filter(isRemovalChange).map(getChangeData)
    .filter(group => group.value.default === true)
  const defaultGroupModification = groupChanges.filter(isModificationChange)
    .filter(change => change.data.before.value.default !== change.data.after.value.default).map(getChangeData)

  return [
    defaultGroupAddition.map(defaultGroupAdditionError),
    defaultGroupRemoval.map(defaultGroupRemovalError),
    defaultGroupModification.map(defaultGroupModificationError),
  ].flat()
}
