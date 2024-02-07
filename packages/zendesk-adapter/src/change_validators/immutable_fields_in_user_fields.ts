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

import { ChangeError, ChangeValidator, getChangeData,
  isInstanceChange,
  isModificationChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'

import { USER_FIELD_TYPE_NAME } from '../constants'

const log = logger(module)

/*
 * This change validator checks that within a user field, the type and the key don't change
 * These fields are not editable and so we should fail mutations that attempt to alter
 * them
 */
export const immutableTypeAndKeyForUserFieldsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run immutableTypeAndKeyForUserFieldsValidator because element source is undefined')
    return []
  }

  const userFieldChanges = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === USER_FIELD_TYPE_NAME)

  if (userFieldChanges.length === 0) {
    return []
  }

  return userFieldChanges
    .flatMap(change => {
      const before = change.data.before.value
      const after = change.data.after.value
      const errors: ChangeError[] = []
      if (before.key !== after.key) {
        errors.push({
          elemID: change.data.after.elemID,
          severity: 'Error',
          message: 'User Field Key is not editable',
          detailedMessage: `The key for this User Field (${before.key}) is not editable, and should not be changed.`,
        })
      }
      if (before.type !== after.type) {
        errors.push({
          elemID: change.data.after.elemID,
          severity: 'Error',
          message: 'User Field Type is not editable',
          detailedMessage: `The type for this User Field (${before.type}) is not editable, and should not be changed.`,
        })
      }
      return errors
    })
}
