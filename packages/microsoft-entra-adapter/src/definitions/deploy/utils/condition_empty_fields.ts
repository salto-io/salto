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

import { getChangeData, isAdditionChange, isEqualValues, isModificationChange } from '@salto-io/adapter-api'
import { definitions } from '@salto-io/adapter-components'
import _ from 'lodash'

/*
 * Creates a custom condition that returns true if at least one of the specified fields is not empty
 * For addition changes this custom condition must be used instead of transformForCheck field
 * since transformForCheck is irrelevant for addition changes.
 */
export const createCustomConditionEmptyFields = (fieldNames: string[]): definitions.deploy.DeployRequestCondition => ({
  custom:
    () =>
    ({ change }) => {
      if (isAdditionChange(change)) {
        return !_.isEmpty(_.pick(getChangeData(change).value, fieldNames))
      }
      if (isModificationChange(change)) {
        return !isEqualValues(_.pick(change.data.before.value, fieldNames), _.pick(change.data.after.value, fieldNames))
      }
      return false
    },
})
