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
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isPlaceholderObjectType,
} from '@salto-io/adapter-api'

const createInstanceWithoutTypeError = (
  change: Change<InstanceElement>,
): ChangeError => {
  const instance = getChangeData(change)
  return {
    elemID: instance.elemID,
    message: 'Instance of unknown type',
    detailedMessage: `Cannot ${change.action} instance ${instance.elemID.getFullName()} because its type is unknown.`,
    severity: 'Error',
  }
}

const changeValidator: ChangeValidator = async (changes) =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter((change) =>
      isPlaceholderObjectType(getChangeData(change).getTypeSync()),
    )
    .map(createInstanceWithoutTypeError)

export default changeValidator
