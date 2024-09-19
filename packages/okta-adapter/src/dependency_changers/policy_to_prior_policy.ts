/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

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
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { POLICY_PRIORITY_TYPE_NAMES, POLICY_RULE_PRIORITY_TYPE_NAMES } from '../constants'
import { ALL_SUPPORTED_POLICY_NAMES, POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE } from '../filters/policy_priority'

const { isDefined } = values

const createDependencyChange = (
  prevPolicyOrPolicyRule: deployment.dependency.ChangeWithKey<Change<InstanceElement>>,
  policyOrPolicyRule: deployment.dependency.ChangeWithKey<Change<InstanceElement>>,
): DependencyChange[] => [dependencyChange('add', policyOrPolicyRule.key, prevPolicyOrPolicyRule.key)]

/*
 * This dependency handler ensures that dependencies are added between each policy or policyRule during addition changes.
 * The dependency is added based on the priority change and if its none than by order by name
 * This prevents race conditions that could result in policies being assigned the same priority.
 */

export const addDependenciesFromPolicyToPriorPolicy: DependencyChanger = async changes => {
  const instanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter((change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const [additionPoliciesAndRulesChanges, priorityChanges] = _.partition(
    instanceChanges.filter(change =>
      [
        ...ALL_SUPPORTED_POLICY_NAMES,
        ...POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE,
        ...POLICY_PRIORITY_TYPE_NAMES,
        ...POLICY_RULE_PRIORITY_TYPE_NAMES,
      ].includes(getChangeData(change.change).elemID.typeName),
    ),
    change =>
      [...ALL_SUPPORTED_POLICY_NAMES, ...POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE].includes(
        getChangeData(change.change).elemID.typeName,
      ) && isAdditionChange(change.change),
  )

  if (_.isEmpty(additionPoliciesAndRulesChanges)) {
    return []
  }

  const policyNameToChange = Object.fromEntries(
    additionPoliciesAndRulesChanges.map(policyChange => {
      const instance = getChangeData(policyChange.change)
      return [instance.elemID.getFullName(), policyChange]
    }),
  )

  // Map priority full names to related policy changes
  const priorityFullNameToPoliciesChanges = Object.fromEntries(
    priorityChanges.map(priorityChange => {
      const priorityInstance = getChangeData(priorityChange.change)
      const policies = priorityInstance.value.priorities
        .filter(isReferenceExpression)
        .map((ref: ReferenceExpression) => ref.elemID.getFullName())
        .map((refName: string) => policyNameToChange[refName])
        .filter(isDefined)
      return [priorityInstance.elemID.getFullName(), policies]
    }),
  )

  const policiesWithPriorityChange = new Set(Object.values(priorityFullNameToPoliciesChanges).flat())

  // Organize changes by typeName excluding those with priority changes
  const typeNameToPolicyChanges = additionPoliciesAndRulesChanges
    .filter(policyChange => !policiesWithPriorityChange.has(policyChange))
    .reduce(
      (acc, policyChange) => {
        const { typeName } = getChangeData(policyChange.change).elemID
        if (!acc[typeName]) {
          acc[typeName] = []
        }

        acc[typeName].push(policyChange)
        return acc
      },
      {} as Record<string, typeof additionPoliciesAndRulesChanges>,
    )

  const policiesGroups = Object.values(typeNameToPolicyChanges).concat(Object.values(priorityFullNameToPoliciesChanges))

  return policiesGroups
    .flatMap(group =>
      group.slice(1).map((currentPolicyChange, index) => {
        const previousPolicyChange = group[index]
        return createDependencyChange(previousPolicyChange, currentPolicyChange)
      }),
    )
    .flat()
}
