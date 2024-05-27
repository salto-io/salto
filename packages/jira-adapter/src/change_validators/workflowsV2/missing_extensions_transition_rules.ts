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
import JiraClient, { ExtensionType } from '../../client/client'
import {
  isWorkflowV2Instance,
  WorkflowV2ConditionGroup,
  WorkflowV2TransitionRule,
  WorkflowV2Instance,
} from '../../filters/workflowV2/types'

const { awu } = collections.asynciterable

enum RuleType {
  Connect = 'connect',
  Forge = 'forge',
  System = 'system',
  Invalid = 'invalid',
}

type TransitionRuleWithElemIDType = WorkflowV2TransitionRule & { elemID: ElemID }

const isValidRuleType = (value: any): value is RuleType =>
  Object.values(RuleType)
    .filter(ruleType => ruleType !== RuleType.Invalid)
    .includes(value)

const getRuleTypeFromRuleKey: (ruleKey: string) => RuleType = ruleKey => {
  // ruleKey is of the format "<type>:<some-string>"
  const ruleType = ruleKey.split(':')[0]
  if (!isValidRuleType(ruleType)) {
    return RuleType.Invalid
  }

  return ruleType
}

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
  conditionGroup?: WorkflowV2ConditionGroup,
) => TransitionRuleWithElemIDType[] = (elemID, conditionGroup) => {
  if (conditionGroup === undefined) {
    return []
  }
  const conditionRules: TransitionRuleWithElemIDType[] = []
  const conditionGroupsRules: TransitionRuleWithElemIDType[] = []
  if (conditionGroup.conditions !== undefined) {
    conditionRules.push(
      ...tagTransitionRulesWithIndexElemID(elemID.createNestedID('conditions'), conditionGroup.conditions),
    )
  }
  if (conditionGroup.conditionGroups !== undefined) {
    conditionGroupsRules.push(
      ...conditionGroup.conditionGroups.flatMap((cg: WorkflowV2ConditionGroup, index: number) =>
        getConditionRules(elemID.createNestedID('conditionGroups', index.toString()), cg),
      ),
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

export const getRuleTypeFromWorkflowTransitionRule = (transitionRule: WorkflowV2TransitionRule): RuleType =>
  getRuleTypeFromRuleKey(transitionRule.ruleKey)

const getExtensionKeyFromWorkflowTransitionRule = (transitionRule: WorkflowV2TransitionRule): string | undefined => {
  const ruleType = getRuleTypeFromWorkflowTransitionRule(transitionRule)

  switch (ruleType) {
    case RuleType.Connect:
      return _.get(transitionRule, 'parameters.appKey', undefined)
    case RuleType.Forge:
      return _.get(transitionRule, 'parameters.key', undefined)
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

export const getInstalledExtensionsMap = async (client: JiraClient): Promise<Record<string, ExtensionType>> =>
  awu(await client.getInstalledExtensions()).reduce(
    (acc, app) => {
      acc[app.id] = app
      return acc
    },
    {} as Record<string, ExtensionType>,
  )

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
    const installedExtensionsMap = await getInstalledExtensionsMap(client)
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
              detailedMessage: `Can't deploy a transition rule from missing Jira app: ${getExtensionIdFromWorkflowTransitionRule(transitionRule)}.`,
            },
      )
  }
