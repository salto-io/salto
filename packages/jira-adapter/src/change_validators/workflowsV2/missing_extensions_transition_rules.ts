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
import { collections } from '@salto-io/lowerdash'
import {
  ChangeValidator,
  SeverityLevel,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
  ElemID,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import JiraClient from '../../client/client'
import {
  isWorkflowV2Instance,
  WorkflowV2TransitionConditionGroup,
  WorkflowV2TransitionRule,
  WorkflowV2Instance,
} from '../../filters/workflowV2/types'
import { getInstalledExtensionsMap, ExtensionType } from '../../common/extensions'
import {
  getRuleTypeFromWorkflowTransitionRule,
  RuleType,
  getExtensionIdFromWorkflowTransitionRule,
} from '../../common/workflow/transition_rules'

const { awu } = collections.asynciterable
const log = logger(module)

type TransitionRuleWithElemIDType = WorkflowV2TransitionRule & { elemID: ElemID }

const tagTransitionRulesWithIndexElemID = (
  elemID: ElemID,
  transitionRules?: WorkflowV2TransitionRule[],
): TransitionRuleWithElemIDType[] => {
  if (transitionRules === undefined) {
    return []
  }

  return transitionRules.map((rule, index) => ({ elemID: elemID.createNestedID(index.toString()), ...rule }))
}

const getConditionRules: (
  elemID: ElemID,
  conditionGroup?: WorkflowV2TransitionConditionGroup,
) => TransitionRuleWithElemIDType[] = (elemID, conditionGroup) => {
  if (conditionGroup === undefined) {
    return []
  }
  let conditionRules: TransitionRuleWithElemIDType[] = []
  let conditionGroupsRules: TransitionRuleWithElemIDType[] = []
  if (conditionGroup.conditions !== undefined) {
    conditionRules = tagTransitionRulesWithIndexElemID(elemID.createNestedID('conditions'), conditionGroup.conditions)
  }
  if (conditionGroup.conditionGroups !== undefined) {
    conditionGroupsRules = conditionGroup.conditionGroups.flatMap(
      (cg: WorkflowV2TransitionConditionGroup, index: number) =>
        getConditionRules(elemID.createNestedID('conditionGroups', index.toString()), cg),
    )
  }

  return [...conditionRules, ...conditionGroupsRules]
}

const getTransitionRulesWithElemID: (workflow: WorkflowV2Instance) => TransitionRuleWithElemIDType[] = workflow =>
  Object.entries(workflow.value.transitions).flatMap(([transitionName, transition]) => {
    const transitionElemID = workflow.elemID.createNestedID('transitions', transitionName)

    const validatorRules = tagTransitionRulesWithIndexElemID(
      transitionElemID.createNestedID('validators'),
      transition.validators,
    )
    const actionRules = tagTransitionRulesWithIndexElemID(
      transitionElemID.createNestedID('actions'),
      transition.actions,
    )
    const conditionRules = getConditionRules(transitionElemID.createNestedID('conditions'), transition.conditions)
    return [...validatorRules, ...actionRules, ...conditionRules]
  })

export const missingExtensionsTransitionRulesChangeValidator =
  (client: JiraClient): ChangeValidator =>
  async changes => {
    const relevantRules = await awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isWorkflowV2Instance)
      .flatMap(getTransitionRulesWithElemID)
      .filter(transitionRule => getRuleTypeFromWorkflowTransitionRule(transitionRule) !== RuleType.System)
      .toArray()

    // The following steps perform requests to Jira API and so we first make sure it is required.
    if (_.isEmpty(relevantRules)) {
      return []
    }

    let installedExtensionsMap: Record<string, ExtensionType>
    try {
      installedExtensionsMap = await getInstalledExtensionsMap(client)
    } catch (error) {
      log.error("Couldn't fetch installed extensions.")
      return []
    }

    return relevantRules
      .filter(transitionRule => {
        const extensionId = getExtensionIdFromWorkflowTransitionRule(transitionRule)
        return extensionId === undefined || !(extensionId in installedExtensionsMap)
      })
      .map(transitionRule =>
        getRuleTypeFromWorkflowTransitionRule(transitionRule) === RuleType.Invalid
          ? {
              elemID: transitionRule.elemID,
              severity: 'Warning' as SeverityLevel,
              message: 'Attempted to deploy a transition rule of unknown type',
              detailedMessage: `Unrecognized type of ruleKey: ${transitionRule.ruleKey}.`,
            }
          : {
              elemID: transitionRule.elemID,
              severity: 'Error' as SeverityLevel,
              message: 'Attempted to deploy a transition rule of a missing Jira app',
              detailedMessage: `Can't deploy a transition rule from missing Jira app: ${getExtensionIdFromWorkflowTransitionRule(transitionRule)}. Make sure to install the missing application and try again.`,
            },
      )
  }
