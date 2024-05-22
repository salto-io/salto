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
  WorkflowV2TransitionRuleParameters,
  WorkflowV2TransitionRule,
  WorkflowV2Instance,
} from '../../filters/workflowV2/types'

const { awu } = collections.asynciterable

enum ExtensionRuleType {
  Connect = 'connect',
  Forge = 'forge',
}
enum SystemRuleType {
  System = 'system',
}

type RuleType = ExtensionRuleType | SystemRuleType

type TransitionRuleType = {
  elemID: ElemID
  category: string
  ruleType: RuleType
  ruleKey: string
  extensionKey?: string
}

type ExtensionTransitionRuleType = Required<Omit<TransitionRuleType, 'ruleType'> & { ruleType: ExtensionRuleType }>

const getKeyFromParameters = (parameters?: WorkflowV2TransitionRuleParameters): string | undefined => {
  if (parameters === undefined) {
    return undefined
  }
  if ('appKey' in parameters) {
    return parameters.appKey
  }
  if ('key' in parameters) {
    return parameters.key
  }
  return undefined
}

const isRuleType = (value: any): value is RuleType =>
  Object.values(ExtensionRuleType).includes(value) || Object.values(SystemRuleType).includes(value)

const getRuleTypeFromRuleKey: (ruleKey: string) => RuleType = ruleKey => {
  const ruleType = ruleKey.split(':')[0]
  if (!isRuleType(ruleType)) {
    throw Error(
      `Unexpected rule type ${ruleType}, expected of one of ${[...Object.values(ExtensionRuleType), ...Object.values(SystemRuleType)]}`,
    )
  }

  return ruleType
}

const getRuleMaker =
  (elemID: ElemID, category: string) =>
  (rule: WorkflowV2TransitionRule, index: number): TransitionRuleType => {
    const { ruleKey } = rule
    const extensionType = getRuleTypeFromRuleKey(ruleKey)
    return {
      category: category,
      ruleType: extensionType,
      ruleKey,
      extensionKey: extensionType === 'system' ? undefined : getKeyFromParameters(rule.parameters),
      elemID: elemID.createNestedID(index.toString()),
    }
  }

const getActionRules: (elemID: ElemID, actions?: WorkflowV2TransitionRule[]) => TransitionRuleType[] = (
  elemID,
  actions,
) => {
  if (actions === undefined) {
    return []
  }
  return actions.map(getRuleMaker(elemID, 'actions'))
}

const getValidatorRules: (elemID: ElemID, validators?: WorkflowV2TransitionRule[]) => TransitionRuleType[] = (
  elemID,
  validators,
) => {
  if (validators === undefined) {
    return []
  }
  return validators.map(getRuleMaker(elemID, 'validators'))
}

const getConditionRules: (elemID: ElemID, conditionGroup?: WorkflowV2ConditionGroup) => TransitionRuleType[] = (
  elemID,
  conditionGroup,
) => {
  if (conditionGroup === undefined) {
    return []
  }
  let conditionRules: TransitionRuleType[] = []
  let conditionGroupsRules: TransitionRuleType[] = []
  if (conditionGroup.conditions !== undefined) {
    conditionRules = conditionGroup.conditions.map(getRuleMaker(elemID.createNestedID('conditions'), 'conditions'))
  }
  if (conditionGroup.conditionGroups !== undefined) {
    conditionGroupsRules = conditionGroup.conditionGroups.flatMap((cg: WorkflowV2ConditionGroup, index: number) =>
      getConditionRules(elemID.createNestedID('conditionGroups', index.toString()), cg),
    )
  }

  return [...conditionRules, ...conditionGroupsRules]
}

export const getInstalledExtensionsMap = async (client: JiraClient): Promise<Record<string, ExtensionType>> =>
  await awu(await client.getInstalledExtensions()).reduce(
    (acc, app) => {
      acc[app.id] = app
      return acc
    },
    {} as Record<string, ExtensionType>,
  )

const isExtensionTransitionRuleType = (
  transitionRule: TransitionRuleType,
): transitionRule is ExtensionTransitionRuleType =>
  transitionRule.ruleType !== SystemRuleType.System && transitionRule.extensionKey !== undefined

const getTransitionRules: (workflow: WorkflowV2Instance) => TransitionRuleType[] = workflow => {
  return Object.entries(workflow.value.transitions).flatMap(([transitionName, transition]) => {
    const transitionID = workflow.elemID.createNestedID('transitions', transitionName)
    const validatorRules = getValidatorRules(transitionID.createNestedID('validators'), transition.validators)
    const actionRules = getActionRules(transitionID.createNestedID('actions'), transition.actions)
    const conditionRules = getConditionRules(transitionID.createNestedID('conditions'), transition.conditions)
    return [...validatorRules, ...actionRules, ...conditionRules]
  })
}

export const getExtensionTransitionRules: (workflow: WorkflowV2Instance) => ExtensionTransitionRuleType[] = workflow =>
  getTransitionRules(workflow).filter(isExtensionTransitionRuleType)

export const getExtensionIdFromTransitionRule = (transitionRule: ExtensionTransitionRuleType): string =>
  transitionRule.ruleType === ExtensionRuleType.Connect
    ? transitionRule.extensionKey.split('__')[0]
    : transitionRule.extensionKey.split('/')[1]

export const missingExtensionsTransitionRulesChangeValidator = (client: JiraClient): ChangeValidator => {
  return async changes => {
    const installedExtensionsMap = await getInstalledExtensionsMap(client)
    return awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isWorkflowV2Instance)
      .flatMap(getExtensionTransitionRules)
      .filter(transitionRule => !(getExtensionIdFromTransitionRule(transitionRule) in installedExtensionsMap))
      .map(transitionRule => ({
        elemID: transitionRule.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Attempted to deploy a transition rule of a missing Jira app',
        detailedMessage: `Can't deploy a transition rule from missing Jira app: ${getExtensionIdFromTransitionRule(transitionRule)}.`,
      }))
      .toArray()
  }
}
