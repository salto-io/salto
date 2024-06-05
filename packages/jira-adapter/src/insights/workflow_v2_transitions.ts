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

import { isInstanceElement, isReferenceExpression, GetInsightsFunc } from '@salto-io/adapter-api'
import { isWorkflowV2Instance, WorkflowV2Transition } from '../filters/workflowV2/types'
import { isReferenceToInstance, isStatusCategoryDone, WORKFLOW_TRANSITION } from './workflow_v1_transitions'

const hasResolutionPostFunc = (transition: WorkflowV2Transition, type: 'set' | 'clear'): boolean =>
  transition.actions?.find(
    action =>
      action.ruleKey === 'system:update-field' &&
      action.parameters !== undefined &&
      isReferenceToInstance(action.parameters.field) &&
      action.parameters.field.value.value.name === 'Resolution' &&
      ((type === 'set' && action.parameters.value !== undefined) ||
        (type === 'clear' && action.parameters.value === undefined)),
  ) !== undefined

const isTransitionToStatusCategoryDoneWithoutSettingResolution = (transition: WorkflowV2Transition): boolean =>
  isStatusCategoryDone(transition.to?.statusReference) && !hasResolutionPostFunc(transition, 'set')

const isTransitionOutOfStatusCategoryDoneWithoutClearingResolution = (transition: WorkflowV2Transition): boolean =>
  transition.from?.find(status => isStatusCategoryDone(status.statusReference)) !== undefined &&
  !hasResolutionPostFunc(transition, 'clear')

const isTransitionNotSettingResolution = (transition: WorkflowV2Transition): boolean =>
  !hasResolutionPostFunc(transition, 'set') && !hasResolutionPostFunc(transition, 'clear')

const isTransitionWithoutOpsbarSequenceProperty = (transition: WorkflowV2Transition): boolean =>
  transition.properties?.find(prop => prop?.key === 'opsbar-sequence') === undefined

const isTransitionFromStatusToItself = (transition: WorkflowV2Transition): boolean =>
  transition.from?.find(
    status =>
      isReferenceExpression(status.statusReference) &&
      transition.to !== undefined &&
      isReferenceExpression(transition.to.statusReference) &&
      status.statusReference.elemID.isEqual(transition.to.statusReference.elemID),
  ) !== undefined

const getInsights: GetInsightsFunc = elements => {
  const workflowInstances = elements.filter(isInstanceElement).filter(isWorkflowV2Instance)
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
