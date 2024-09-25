/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  Change,
  DependencyChange,
  DependencyChanger,
  InstanceElement,
  ReferenceExpression,
  dependencyChange,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { getParent } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { POLICY_PRIORITY_TYPE_NAMES, POLICY_RULE_PRIORITY_TYPE_NAMES } from '../constants'
import { ALL_SUPPORTED_POLICY_NAMES, POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE } from '../filters/policy_priority'

const log = logger(module)
type ChangeWithKey = deployment.dependency.ChangeWithKey<Change<InstanceElement>>

const createDependencyChange = (prev: ChangeWithKey, current: ChangeWithKey): DependencyChange[] => [
  dependencyChange('add', current.key, prev.key),
]

const groupChangesByType = (changes: ChangeWithKey[]): Record<string, ChangeWithKey[]> =>
  changes.reduce(
    (acc, change) => {
      const instance = getChangeData(change.change)
      const { typeName } = instance.elemID
      if (!acc[typeName]) {
        acc[typeName] = []
      }
      acc[typeName].push(change)
      return acc
    },
    {} as Record<string, ChangeWithKey[]>,
  )

const groupRuleChangesByPolicy = (changes: ChangeWithKey[]): Record<string, ChangeWithKey[]> =>
  changes.reduce(
    (acc, change) => {
      const instance = getChangeData(change.change)
      try {
        const parent = getParent(instance)
        const parentFullName = parent.elemID.getFullName()
        if (!acc[parentFullName]) {
          acc[parentFullName] = []
        }
        acc[parentFullName].push(change)
      } catch (e) {
        log.error('Failed to get parent for %s', instance.elemID.getFullName())
      }
      return acc
    },
    {} as Record<string, ChangeWithKey[]>,
  )

const getGroupedPoliciesAndRules = (
  additionPolicyChanges: ChangeWithKey[],
  additionRuleChanges: ChangeWithKey[],
): {
  policies: ChangeWithKey[][]
  rules: ChangeWithKey[][]
} => ({
  policies: Object.values(groupChangesByType(additionPolicyChanges)),
  rules: Object.values(groupRuleChangesByPolicy(additionRuleChanges)),
})

const sortByPriority = (group: ChangeWithKey[], priorityMap: Record<string, number>): ChangeWithKey[] =>
  group.sort((change1, change2) => {
    const priority1 = priorityMap[getChangeData(change1.change).elemID.getFullName()] ?? Infinity
    const priority2 = priorityMap[getChangeData(change2.change).elemID.getFullName()] ?? Infinity
    return priority1 - priority2
  })

/*
 * This dependency handler ensures that dependencies are added between each policy or policyRule during addition changes.
 * The dependency is added based on the priority change and if its none then by order by name
 * This prevents race conditions that could result in policies being assigned the same priority.
 */
export const addDependenciesFromPolicyToPriorPolicy: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is ChangeWithKey => isInstanceChange(change.change))

  const additionPolicyChanges = instanceChanges
    .filter(
      change =>
        ALL_SUPPORTED_POLICY_NAMES.includes(getChangeData(change.change).elemID.typeName) &&
        isAdditionChange(change.change),
    )
    .filter(change => getChangeData(change.change).value.system !== true)

  const additionRuleChanges = instanceChanges
    .filter(
      change =>
        POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE.includes(getChangeData(change.change).elemID.typeName) &&
        isAdditionChange(change.change),
    )
    .filter(change => getChangeData(change.change).value.system !== true)

  const prioritiesTypeNamesSet = new Set([...POLICY_PRIORITY_TYPE_NAMES, ...POLICY_RULE_PRIORITY_TYPE_NAMES])
  const priorityChanges = instanceChanges.filter(change =>
    prioritiesTypeNamesSet.has(getChangeData(change.change).elemID.typeName),
  )

  if (_.isEmpty(additionPolicyChanges) && _.isEmpty(additionRuleChanges)) {
    return []
  }

  // Map priority names to related policy or rules names
  const priorityNameToPoliciesOrRuleNames: Record<string, string[]> = Object.fromEntries(
    priorityChanges.map(priorityChange => {
      const priorityInstance = getChangeData(priorityChange.change)
      const policies = priorityInstance.value.priorities
        .filter(isReferenceExpression)
        .map((ref: ReferenceExpression) => ref.elemID.getFullName())
      return [priorityInstance.elemID.getFullName(), policies]
    }),
  )

  // Map each policy or rule name to its priority position
  const policyNameToPriority = Object.fromEntries(
    Object.entries(priorityNameToPoliciesOrRuleNames).flatMap(([priorityFullName, policyNames]) =>
      policyNames.map(policyName => [
        policyName,
        priorityNameToPoliciesOrRuleNames[priorityFullName]?.indexOf(policyName) ?? Infinity,
      ]),
    ),
  )

  const { policies, rules } = getGroupedPoliciesAndRules(additionPolicyChanges, additionRuleChanges)

  policies.forEach(policyGroup => sortByPriority(policyGroup, policyNameToPriority))
  rules.forEach(ruleGroup => sortByPriority(ruleGroup, policyNameToPriority))

  return policies
    .concat(rules)
    .flatMap(group => {
      log.debug(
        'About to add dependencies for %s',
        group.map(change => getChangeData(change.change).elemID.getFullName()),
      )
      return group.slice(1).map((currentPolicyChange, index) => {
        const previousPolicyChange = group[index]
        return createDependencyChange(previousPolicyChange, currentPolicyChange)
      })
    })
    .flat()
}
