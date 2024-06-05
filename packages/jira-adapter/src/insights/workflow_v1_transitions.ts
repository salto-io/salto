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

import _ from 'lodash'
import { isInstanceElement, isReferenceExpression, InstanceElement, GetInsightsFunc } from '@salto-io/adapter-api'
import { isWorkflowV1Instance, Transition } from '../filters/workflow/types'

export const WORKFLOW_TRANSITION = 'workflowTransition'

export const isReferenceToInstance = (ref: unknown): ref is { value: InstanceElement } =>
  isReferenceExpression(ref) && isInstanceElement(ref.value)

export const isStatusCategoryDone = (ref: unknown): boolean =>
  isReferenceToInstance(ref) &&
  isReferenceToInstance(ref.value.value.statusCategory) &&
  ref.value.value.statusCategory.value.value.key === 'done'

const hasResolutionPostFunc = (transition: Transition, type: 'set' | 'clear'): boolean =>
  transition.rules?.postFunctions?.find(
    func =>
      func.configuration !== undefined &&
      isReferenceToInstance(func.configuration.fieldId) &&
      func.configuration.fieldId.value.value.name === 'Resolution' &&
      ((type === 'set' && func.type === 'UpdateIssueFieldFunction' && func.configuration.fieldValue !== '') ||
        (type === 'clear' && func.type === 'UpdateIssueFieldFunction' && func.configuration.fieldValue === '') ||
        (type === 'clear' && func.type === 'ClearFieldValuePostFunction')),
  ) !== undefined

const isTransitionToStatusCategoryDoneWithoutSettingResolution = (transition: Transition): boolean =>
  isStatusCategoryDone(transition.to) && !hasResolutionPostFunc(transition, 'set')

const isTransitionOutOfStatusCategoryDoneWithoutClearingResolution = (transition: Transition): boolean =>
  transition.from?.find(status => !_.isString(status) && isStatusCategoryDone(status.id)) !== undefined &&
  !hasResolutionPostFunc(transition, 'clear')

const isTransitionNotSettingResolution = (transition: Transition): boolean =>
  !hasResolutionPostFunc(transition, 'set') && !hasResolutionPostFunc(transition, 'clear')

const isTransitionWithoutOpsbarSequenceProperty = (transition: Transition): boolean =>
  Object.values(transition.properties ?? []).find(prop => prop?.key === 'opsbar-sequence') === undefined

const isTransitionFromStatusToItself = (transition: Transition): boolean =>
  transition.from?.find(
    status =>
      !_.isString(status) &&
      isReferenceExpression(status.id) &&
      isReferenceExpression(transition.to) &&
      status.id.elemID.isEqual(transition.to.elemID),
  ) !== undefined

const getInsights: GetInsightsFunc = elements => {
  const workflowInstances = elements.filter(isInstanceElement).filter(isWorkflowV1Instance)
  const workflowTransitions = workflowInstances.flatMap(instance =>
    Object.entries(instance.value.transitions).map(([key, value]) => ({
      path: instance.elemID.createNestedID('transitions', key),
      value,
    })),
  )

  const transitionsToStatusCategoryDoneWithoutSettingResolution = workflowTransitions
    .filter(transition => isTransitionToStatusCategoryDoneWithoutSettingResolution(transition.value))
    .map(transition => ({
      path: transition.path,
      ruleId: `${WORKFLOW_TRANSITION}.toStatusDoneWithoutResolution`,
      message: 'Transition to a status category DONE without setting a resolution',
    }))

  const transitionsOutOfStatusCategoryDoneWithoutClearingResolution = workflowTransitions
    .filter(transition => isTransitionOutOfStatusCategoryDoneWithoutClearingResolution(transition.value))
    .map(transition => ({
      path: transition.path,
      ruleId: `${WORKFLOW_TRANSITION}.fromStatusDoneWithoutClearResolution`,
      message: 'Transition out of a status category DONE without clearing the resolution',
    }))

  const transitionsNotSettingResolution = workflowTransitions
    .filter(transition => isTransitionNotSettingResolution(transition.value))
    .map(transition => ({
      path: transition.path,
      ruleId: `${WORKFLOW_TRANSITION}.noResolution`,
      message: 'Transition do not set a resolution',
    }))

  const transitionsWithoutOpsbarSequenceProperty = workflowTransitions
    .filter(transition => isTransitionWithoutOpsbarSequenceProperty(transition.value))
    .map(transition => ({
      path: transition.path,
      ruleId: `${WORKFLOW_TRANSITION}.noOpsbaseSequence`,
      message: 'Transition do not have an opsbar sequence button set',
    }))

  const transitionsFromStatusToItself = workflowTransitions
    .filter(transition => isTransitionFromStatusToItself(transition.value))
    .map(transition => ({
      path: transition.path,
      ruleId: `${WORKFLOW_TRANSITION}.statusLoop`,
      message: 'Transition from a status to itself',
    }))

  return transitionsToStatusCategoryDoneWithoutSettingResolution
    .concat(transitionsOutOfStatusCategoryDoneWithoutClearingResolution)
    .concat(transitionsNotSettingResolution)
    .concat(transitionsWithoutOpsbarSequenceProperty)
    .concat(transitionsFromStatusToItself)
}

export default getInsights
