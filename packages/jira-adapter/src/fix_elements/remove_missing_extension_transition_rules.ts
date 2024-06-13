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
import { collections, types } from '@salto-io/lowerdash'
import { FixElementsHandler } from './types'
import { getInstalledExtensionsMap, ExtensionType } from '../common/extensions'
import {
  WorkflowV2TransitionConditionGroup,
  WorkflowV2Transition,
  WorkflowV2TransitionRule,
  isWorkflowV2Instance,
} from '../filters/workflowV2/types'
import { getExtensionIdFromWorkflowTransitionRule } from '../common/workflow/transition_rules'
import { SeverityLevel } from '../../../adapter-api/src/error'

const { awu } = collections.asynciterable

/**
 * This method updates an object's WorkflowV2TransitionRule[] and returns whether it was changed or not.
 * @param obj An object that has property with the name given in key that maps to WorkflowV2TransitionRule[].
 *            In our case, it'll either be a WorkflowV2Transition or WorkflowV2TransitionConditionGroup.
 * @param key The name of the property with value that is of type WorkflowV2TransitionRule[]
 *            (validators/actions for WorkflowV2Transition or conditions for WorkflowV2TransitionConditionGroup)
 * @param predicate Function that checks whether WorkflowV2TransitionRule should be filtered out or not.
 * @returns boolean indicating whether obj[key] was updated or not.
 */
const updateAndCheckTransitionRules = <
  K extends string,
  T extends Partial<types.HasKeyOfType<K, WorkflowV2TransitionRule[]>>,
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
  const hasFixedConditions = updateAndCheckTransitionRules(conditionGroup, 'conditions', predicate)

  if (conditionGroup.conditionGroups !== undefined) {
    const hasFixedConditionGroups = conditionGroup.conditionGroups.map(innerConditionGroup =>
      updateAndCheckWorkflowConditionGroup(predicate, innerConditionGroup),
    )
    return hasFixedConditions || _.some(hasFixedConditionGroups)
  }
  return hasFixedConditions
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
  const hasFixedActions = updateAndCheckTransitionRules(transition, 'actions', checkExtensionForRule)
  // Fix validators rules
  const hasFixedValidators = updateAndCheckTransitionRules(transition, 'validators', checkExtensionForRule)
  // Fix condition rules
  const hasFixedConditions = updateAndCheckWorkflowConditionGroup(checkExtensionForRule, transition.conditions)

  return hasFixedActions || hasFixedValidators || hasFixedConditions
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

    const relevantElements = await awu(elements)
      .filter(isInstanceElement)
      .map(instance => instance.clone())
      .filter(isWorkflowV2Instance)
      .toArray()

    if (_.isEmpty(relevantElements)) {
      return { fixedElements: [], errors: [] }
    }

    const installedExtensionsMap: Record<string, ExtensionType> = await getInstalledExtensionsMap(client)
    const fixedTransitions: ElemID[] = []

    const fixedElements = relevantElements.filter(workflowInstance =>
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

    const errors = fixedTransitions.map(id => ({
      elemID: id,
      severity: 'Info' as SeverityLevel,
      message: 'Deploying workflow transition without all of its rules.',
      detailedMessage:
        'This workflow transition contains rules for Jira apps that do not exist in the target environment. It will be deployed without them.',
    }))

    return {
      fixedElements,
      errors,
    }
  }
