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
  GetCustomReferencesFunc,
  InstanceElement,
  ReferenceInfo,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { POLICY_RULE_PRIORITY_TYPE_NAMES } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'

const { awu } = collections.asynciterable

const log = logger(module)

const getFieldReferences = async (instance: InstanceElement): Promise<ReferenceInfo[]> => {
  const { priorities } = instance.value
  if (priorities === undefined || !Array.isArray(priorities)) {
    // priorities can be undefined if the policy has no custom rules
    log.debug(
      `priorities value is undefined or not an array in instance ${instance.elemID.getFullName()}, hence not calculating rules weak references`,
    )
    return []
  }

  return awu(priorities)
    .map(async (rule, index) =>
      isReferenceExpression(rule)
        ? { source: instance.elemID.createNestedID(index.toString()), target: rule.elemID, type: 'weak' as const }
        : undefined,
    )
    .filter(values.isDefined)
    .toArray()
}

/**
 * Marks each rule reference in policyPriority as a weak reference.
 */
const getPolicyPriorityReferences: GetCustomReferencesFunc = async elements =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(instance => POLICY_RULE_PRIORITY_TYPE_NAMES.includes(instance.elemID.typeName))
    .flatMap(getFieldReferences)
    .toArray()

/**
 * Remove invalid rules (not references or missing references) from policyPriority.
 */
const removeMissingPolicyRulePriorities: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async elements => {
    const fixedElements = await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => POLICY_RULE_PRIORITY_TYPE_NAMES.includes(instance.elemID.typeName))
      .map(async instance => {
        const { priorities } = instance.value
        if (priorities === undefined) {
          return undefined
        }
        const fixedInstance = instance.clone()
        fixedInstance.value.priorities = await awu(priorities)
          .filter(
            async rule =>
              rule !== undefined &&
              isReferenceExpression(rule) &&
              // eslint-disable-next-line no-return-await
              (await elementsSource.has(rule.elemID)),
          )
          .toArray()

        if (fixedInstance.value.priorities.length === instance.value.priorities.length) {
          return undefined
        }

        return fixedInstance
      })
      .filter(values.isDefined)
      .toArray()

    const errors = fixedElements.map(instance => ({
      elemID: instance.elemID.createNestedID('priorities'),
      severity: 'Info' as const,
      message: `${instance.elemID.typeName} will be deployed without priorities defined on non-existing fields`,
      detailedMessage:
        'This policy priority has priorities which use rules which no longer exist. It will be deployed without them.',
    }))
    return { fixedElements, errors }
  }

export const policyRulePrioritiesHandler: WeakReferencesHandler = {
  findWeakReferences: getPolicyPriorityReferences,
  removeWeakReferences: removeMissingPolicyRulePriorities,
}
