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
import {
  ChangeValidator,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { GROUP_MEMBER_TYPE_NAME } from '../constants'

const isGroupRoleChange = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  return before.value.role !== after.value.role && after.value.type !== 'USER'
}

// When a group is a group member of other groups, the role can not be changed and must be 'MEMBER'
export const groupMemberRoleValidator: ChangeValidator = async changes =>
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => change.data.after.elemID.typeName === GROUP_MEMBER_TYPE_NAME)
    .filter(isGroupRoleChange)
    .map(getChangeData)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can not edit group member role for groups',
        detailedMessage: 'Can not edit group member role for groups',
      },
    ])
