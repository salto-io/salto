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
import { ChangeError, ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { isWorkflowInstance, WorkflowInstance } from '../../filters/workflow/types'

const { isDefined } = values
export const CONFIGURATION_VALIDATOR_TYPE = new Set([
  'FieldChangedValidator',
  'FieldHasSingleValueValidator',
  'ParentStatusValidator',
  'ProFormaFormsAttachedValidator',
  'ProFormaFormsSubmittedValidator',
  'DateFieldValidator',
  'PermissionValidator',
  'PreviousStatusValidator',
  'RegexpFieldValidator',
  'UserPermissionValidator',
  'WindowsDateValidator',
])

const workflowHasEmptyValidator = (instance: WorkflowInstance): Set<string> => {
  const invalidValidators = new Set<string>()
  instance.value.transitions?.forEach(transition => {
    transition.rules?.validators?.forEach(validator => {
      if (validator.type !== undefined && CONFIGURATION_VALIDATOR_TYPE.has(validator.type) && !('configuration' in validator)) {
        invalidValidators.add(validator.type)
      }
    })
  })
  return invalidValidators
}

const createEmptyValidatorWorkflowError = (
  instance: WorkflowInstance,
  validatorType: Set<string>,
): ChangeError | undefined => (validatorType.size > 0 ? {
  elemID: instance.elemID,
  severity: 'Warning' as SeverityLevel,
  message: 'Invalid workflow transition validator won’t be deployed',
  detailedMessage: `This workflow has ${validatorType.size === 1 ? `a ${[...validatorType][0]} transition validator` : `the following transition validators ${[...validatorType].join(', ')}`}, which ${validatorType.size === 1 ? 'is' : 'are'} missing some configuration. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its configuration`,
} : undefined)

export const emptyValidatorWorkflowChangeValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowInstance)
    .map(instance => ({ instance, validatorTypes: workflowHasEmptyValidator(instance) }))
    .map(({ instance, validatorTypes }) => createEmptyValidatorWorkflowError(instance, validatorTypes))
    .filter(isDefined)
)
