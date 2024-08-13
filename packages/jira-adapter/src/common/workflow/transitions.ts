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

import { references as referenceUtils } from '@salto-io/adapter-components'
import { ReferenceExpression, Value } from '@salto-io/adapter-api'
import { WorkflowV2Instance, WorkflowV2TransitionRule } from '../../filters/workflowV2/types'
import { WorkflowV1Instance } from '../../filters/workflow/types'

export enum RuleType {
  Connect = 'connect',
  Forge = 'forge',
  System = 'system',
  Invalid = 'invalid',
}

const isValidRuleType = (value: Value): value is RuleType =>
  Object.values(RuleType)
    .filter(ruleType => ruleType !== RuleType.Invalid)
    .includes(value)

export const getRuleTypeFromWorkflowTransitionRule = (transitionRule: WorkflowV2TransitionRule): RuleType => {
  // ruleKey is of the format "<type>:<some-string>"
  const ruleType = transitionRule.ruleKey.split(':')[0]
  if (!isValidRuleType(ruleType)) {
    return RuleType.Invalid
  }

  return ruleType
}

const getExtensionKeyFromWorkflowTransitionRule = (transitionRule: WorkflowV2TransitionRule): string | undefined => {
  const ruleType = getRuleTypeFromWorkflowTransitionRule(transitionRule)

  switch (ruleType) {
    case RuleType.Connect:
      return transitionRule.parameters?.appKey
    case RuleType.Forge:
      return transitionRule.parameters?.key
    default:
      return undefined
  }
}

export const getExtensionIdFromWorkflowTransitionRule = (
  transitionRule: WorkflowV2TransitionRule,
): string | undefined => {
  const ruleType = getRuleTypeFromWorkflowTransitionRule(transitionRule)
  const extensionKey = getExtensionKeyFromWorkflowTransitionRule(transitionRule)
  if (extensionKey === undefined) {
    return undefined
  }
  /**
   * extensionKey is of the following format:
   * Connect) <extension-id>__<suffix>
   * Forge) <prefix>/<extension-id>/<target-cloud-env-id>/<suffix>
   */
  switch (ruleType) {
    case RuleType.Connect:
      return extensionKey.split('__')[0]
    case RuleType.Forge:
      return extensionKey.split('/')[1]
    default:
      return undefined
  }
}

export const getTransitionIdToKeyMap = (
  workflowInstance: WorkflowV1Instance | WorkflowV2Instance,
): Map<string, string> =>
  new Map(
    Object.entries(workflowInstance.value.transitions)
      .map(([key, transition]) => [transition.id, key])
      .filter((entry): entry is [string, string] => entry[0] !== undefined),
  )

export const createTransitionReference = ({
  transitionKey,
  transitionId,
  enableMissingReferences,
  workflowInstance,
}: {
  transitionKey: string | undefined
  transitionId: string
  enableMissingReferences: boolean
  workflowInstance: WorkflowV1Instance | WorkflowV2Instance
}): ReferenceExpression | string => {
  const missingValue = enableMissingReferences
    ? referenceUtils.createMissingValueReference(workflowInstance.elemID.createNestedID('transitions'), transitionId)
    : transitionId
  return transitionKey === undefined
    ? missingValue
    : new ReferenceExpression(
        workflowInstance.elemID.createNestedID('transitions', transitionKey),
        workflowInstance.value.transitions[transitionKey],
      )
}
