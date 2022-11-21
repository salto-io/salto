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
  ChangeError, isModificationChange, isInstanceChange, ChangeValidator, getChangeData,
  InstanceElement, ModificationChange,
} from '@salto-io/adapter-api'
import { INSTANCE_FULL_NAME_FIELD } from '../constants'

export const wasFullnameChanged = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  return before.value[INSTANCE_FULL_NAME_FIELD] !== after.value[INSTANCE_FULL_NAME_FIELD]
}

const fullnameChangeError = (instance: InstanceElement): ChangeError =>
  ({
    elemID: instance.elemID,
    severity: 'Error',
    message: `You cannot change the fullName property of an object. ID of object that was changed: ${instance.elemID}`,
    detailedMessage: 'You cannot change the fullName property of an object.',
  })

/**
 * It is forbidden to add or modify a field with unknown type.
 * A missing type means this field is not accessible on Salesforce.
 */
const changeValidator: ChangeValidator = async changes => (
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(wasFullnameChanged)
    .map(getChangeData)
    .map(fullnameChangeError)
)

export default changeValidator
