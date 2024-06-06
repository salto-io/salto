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

import { Value } from '@salto-io/adapter-api'
import { WorkflowV2TransitionRule } from '../../filters/workflowV2/types'

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
