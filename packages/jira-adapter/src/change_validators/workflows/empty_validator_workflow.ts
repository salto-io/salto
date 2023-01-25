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
import { ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { isWorkflowInstance } from '../../filters/workflow/types'

const { isDefined } = values

const workflowHasEmptyValidator = (instance: InstanceElement): string | undefined => {
  for (const transition of instance.value.transitions) {
    for (const validator of transition.rules.validators) {
      if (!('configuration' in validator)) {
        return validator.type
      }
    }
  }
  return undefined
}

const createEmptyValidatorWorkflowError = (
  instance: InstanceElement,
  validatorType?: string,
): ChangeError | undefined => (validatorType ? {
  elemID: instance.elemID,
  severity: 'Warning' as SeverityLevel,
  message: 'Invalid workflow transition validator won’t be deployed',
  detailedMessage: `This workflow has a ${validatorType} transition validator, which is missing some configuration. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its configuration`,
} : undefined)

export const emptyValidatorWorkflowChangeValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowInstance)
    .map(instance => ({ instance, validatorType: workflowHasEmptyValidator(instance) }))
    .map(({ instance, validatorType }) => createEmptyValidatorWorkflowError(instance, validatorType))
    .filter(isDefined)
)
