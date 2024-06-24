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
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  SeverityLevel,
  Values,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { isWorkflowV1Instance, Transition as TransitionV1, WorkflowV1Instance } from '../../filters/workflow/types'
import {
  isWorkflowInstance,
  isWorkflowV2Instance,
  WorkflowV2Transition,
  WorkflowV2Instance,
} from '../../filters/workflowV2/types'

const { isDefined } = values
export const CONFIGURATION_VALIDATOR_TYPE = new Set([
  'FieldChangedValidator',
  'FieldHasSingleValueValidator',
  'ParentStatusValidator',
  'DateFieldValidator',
  'PermissionValidator',
  'PreviousStatusValidator',
  'RegexpFieldValidator',
  'UserPermissionValidator',
  'WindowsDateValidator',
])

const FIELD_VALIDATOR_TYPE = new Set(['fieldHasSingleValue', 'fieldChanged'])

export const isEmptyValidatorV2 = (validator: Values): boolean =>
  validator.parameters?.ruleType !== undefined &&
  FIELD_VALIDATOR_TYPE.has(validator.parameters.ruleType) &&
  _.isEmpty(validator.parameters.fieldKey)

export const isEmptyValidatorV1 = (validator: Values): boolean =>
  validator.type !== undefined && CONFIGURATION_VALIDATOR_TYPE.has(validator.type) && !('configuration' in validator)

const workflowV1HasEmptyValidator = (transition: TransitionV1, invalidValidators: Set<string>): void => {
  transition.rules?.validators?.forEach(validator => {
    if (validator.type !== undefined && isEmptyValidatorV1(validator)) {
      invalidValidators.add(validator.type)
    }
  })
}

const workflowV2HasEmptyValidator = (transition: WorkflowV2Transition, invalidValidators: Set<string>): void => {
  transition.validators?.forEach(validator => {
    if (isEmptyValidatorV2(validator)) {
      invalidValidators.add(_.get(validator, 'parameters.ruleType'))
    }
  })
}

const workflowHasEmptyValidator = (instance: WorkflowV1Instance | WorkflowV2Instance): Set<string> => {
  const invalidValidators = new Set<string>()
  if (isWorkflowV1Instance(instance)) {
    Object.values(instance.value.transitions).forEach(transition =>
      workflowV1HasEmptyValidator(transition, invalidValidators),
    )
  } else if (isWorkflowV2Instance(instance)) {
    Object.values(instance.value.transitions).forEach(transition =>
      workflowV2HasEmptyValidator(transition, invalidValidators),
    )
  }
  return invalidValidators
}

const createEmptyValidatorWorkflowError = (
  instance: WorkflowV1Instance | WorkflowV2Instance,
  validatorType: Set<string>,
): ChangeError | undefined => {
  if (validatorType.size === 0) {
    return undefined
  }
  const isWorkflowV1 = isWorkflowV1Instance(instance)
  return {
    elemID: instance.elemID,
    severity: 'Warning' as SeverityLevel,
    message: 'Invalid workflow transition validator won’t be deployed',
    detailedMessage: `This workflow has ${validatorType.size === 1 ? `a ${[...validatorType][0]} transition validator` : `the following transition validators ${[...validatorType].join(', ')}`}, which ${validatorType.size === 1 ? 'is' : 'are'} missing ${isWorkflowV1 ? 'some configuration' : "'fieldKey' field"}. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its ${isWorkflowV1 ? 'configuration' : "'fieldKey' field"}`,
  }
}

export const emptyValidatorWorkflowChangeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isWorkflowInstance)
    .map(instance => ({ instance, validatorTypes: workflowHasEmptyValidator(instance) }))
    .map(({ instance, validatorTypes }) => createEmptyValidatorWorkflowError(instance, validatorTypes))
    .filter(isDefined)
