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
/* eslint-disable no-console */

import _ from 'lodash'
import { isInstanceElement, Element, ElemID } from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { FixElementsHandler } from './types'
import { getInstalledExtensionsMap, ExtensionType } from '../common/extensions'
import {
  WorkflowV2TransitionConditionGroup,
  WorkflowV2Transition,
  WorkflowV2TransitionRule,
  isWorkflowV2Instance,
} from '../filters/workflowV2/types'
import { HasKeyOfType, MakeOptional } from '../../../lowerdash/src/types'
import { getExtensionIdFromWorkflowTransitionRule } from '../common/workflow/transition_rules'

const { awu } = collections.asynciterable

const updateAndCheckTransitionRules = <
  K extends string,
  T extends MakeOptional<HasKeyOfType<K, WorkflowV2TransitionRule[]>, K>,
>(
  obj: T,
  key: K,
  predicate: (value: WorkflowV2TransitionRule) => boolean,
): boolean => {
  const old = obj[key]
  obj[key] = old?.filter(predicate) as T[K]

  return old?.length !== obj[key]?.length
}

const updateAndCheckWorkflowConditionGroup = (
  predicate: (transitionRule: WorkflowV2TransitionRule) => boolean,
  conditionGroup?: WorkflowV2TransitionConditionGroup,
): boolean => {
  if (conditionGroup === undefined) {
    return false
  }
  const fixedConditions = updateAndCheckTransitionRules(conditionGroup, 'conditions', predicate)

  if (conditionGroup.conditionGroups !== undefined) {
    const fixedConditionGroups = conditionGroup.conditionGroups.map(innerConditionGroup =>
      updateAndCheckWorkflowConditionGroup(predicate, innerConditionGroup),
    )
    return fixedConditions || _.some(fixedConditionGroups)
  }
  return fixedConditions
}

const updateAndCheckWorkflowTransition = (
  installedExtensionsMap: Record<string, ExtensionType>,
  transition: WorkflowV2Transition,
): boolean => {
  const checkExtensionForRule = (transitionRule: WorkflowV2TransitionRule): boolean => {
    const extensionId = getExtensionIdFromWorkflowTransitionRule(transitionRule)
    return extensionId === undefined ? true : extensionId in installedExtensionsMap
  }

  // Fix action rules
  const fixedActions = updateAndCheckTransitionRules(transition, 'actions', checkExtensionForRule)
  // Fix validators rules
  const fixedValidators = updateAndCheckTransitionRules(transition, 'validators', checkExtensionForRule)
  // Fix condition rules
  const fixedConditions = updateAndCheckWorkflowConditionGroup(checkExtensionForRule, transition.conditions)

  return fixedActions || fixedValidators || fixedConditions
}

/**
 * This fixer makes sure that there are no workflow transitions with rules dependent on Jira apps not installed in the target environment.
 */
export const removeMissingExtensionsTransitionRulesHandler: FixElementsHandler =
  ({ client, config }) =>
  async (elements: Element[]) => {
    if (!config.fetch.enableNewWorkflowAPI || !config.deploy.ignoreMissingExtensions) {
      return { fixedElements: [], errors: [] }
    }
    const installedExtensionsMap: Record<string, ExtensionType> = await getInstalledExtensionsMap(client)
    const fixedTransitions: ElemID[] = []

    const fixedElements = await awu(elements)
      .filter(isInstanceElement)
      .map(instance => instance.clone())
      .filter(isWorkflowV2Instance)
      .filter(workflowInstance =>
        _.some(
          Object.entries(workflowInstance.value.transitions).map(([transitionName, transition]) => {
            if (updateAndCheckWorkflowTransition(installedExtensionsMap, transition)) {
              fixedTransitions.push(workflowInstance.elemID.createNestedID('transitions', transitionName))
              return true
            }
            return false
          }),
        ),
      )
      .filter(values.isDefined)
      .toArray()

    const errors = fixedTransitions.map(id => ({
      elemID: id,
      severity: 'Info' as const,
      message: 'Deploying workflow transition without all of its rules.',
      detailedMessage:
        'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
    }))

    return {
      fixedElements,
      errors,
    }
  }
