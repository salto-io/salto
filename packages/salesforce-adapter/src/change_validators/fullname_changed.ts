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
  ChangeError, isModificationChange, isInstanceChange, ChangeValidator,
  InstanceElement, ModificationChange,
} from '@salto-io/adapter-api'
import { INSTANCE_FULL_NAME_FIELD } from '../constants'


export const wasFullNameChanged = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  return before.value[INSTANCE_FULL_NAME_FIELD] !== after.value[INSTANCE_FULL_NAME_FIELD]
}

const fullNameChangeError = (change: ModificationChange<InstanceElement>): ChangeError => {
  const { before, after } = change.data
  return {
    elemID: after.elemID,
    severity: 'Error',
    message: 'You cannot change the fullName property of an element. '
      + `The fullName property of '${after.elemID.getFullName()}' was changed from `
      + `'${before.value[INSTANCE_FULL_NAME_FIELD]}' to '${after.value[INSTANCE_FULL_NAME_FIELD]}'`,
    detailedMessage: 'You cannot change the fullName property of an element.',
  }
}

/**
 * It is forbidden to modify the fullName property of objects - it is used as an identifier and
 * changing it is not supported.
 */
const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(wasFullNameChanged)
    .map(fullNameChangeError)
)

export default changeValidator
