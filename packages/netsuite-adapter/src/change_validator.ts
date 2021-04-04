/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ChangeValidator } from '@salto-io/adapter-api'
import { createChangeValidator } from '@salto-io/adapter-utils'
import removeCustomizationValidator from './change_validators/remove_customization'
import removeListItemValidator from './change_validators/remove_list_item'
import instanceChangesValidator from './change_validators/instance_changes'
import fileValidator from './change_validators/file_changes'
import immutableChangesValidator from './change_validators/immutable_changes'
import { validateDependsOnInvalidElement } from './change_validators/dependencies'


const changeValidators: ChangeValidator[] = [
  removeCustomizationValidator,
  instanceChangesValidator,
  immutableChangesValidator,
  removeListItemValidator,
  fileValidator,
]

/**
 * This method runs all change validators and then walks recursively on all references of the valid
 * changes to detect changes that depends on invalid ones and then generate errors for them as well
 */
const validateChangesAndDependingElements: ChangeValidator = async changes => {
  const changeErrors = await createChangeValidator(changeValidators)(changes)
  const invalidElementIds = changeErrors.map(error => error.elemID.getFullName())
  return changeErrors.concat(validateDependsOnInvalidElement(invalidElementIds, changes))
}

export default validateChangesAndDependingElements
