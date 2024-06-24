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
  DependencyChange,
  DependencyChanger,
  InstanceElement,
  ModificationChange,
  ReferenceExpression,
  dependencyChange,
  getChangeData,
  isInstanceChange,
  isModificationChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { values } from '@salto-io/lowerdash'
import { POLICY_PRIORITY_TYPE_NAMES, POLICY_RULE_PRIORITY_TYPE_NAMES } from '../constants'
import { ALL_SUPPORTED_POLICY_NAMES, POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE } from '../filters/policy_priority'

const { isDefined } = values

const createDependencyChange = (
  policyOrPolicyRule: deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>>,
  priority: deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>>,
): DependencyChange[] => [dependencyChange('add', priority.key, policyOrPolicyRule.key)]

/*
 * This dependency changer is used to add a dependency from policy or policyRule to its priority instances
 * for modification changes, because we need the policy/policyRule to be deployed before its priority.
 */
export const changeDependenciesFromPoliciesAndRulesToPriority: DependencyChanger = async changes => {
  const modificationInstanceChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(({ change }) => isModificationChange(change))
    .filter((change): change is deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>> =>
      isInstanceChange(change.change),
    )

  const [policiesAndRulesChanges, priorityChanges] = _.partition(
    modificationInstanceChanges.filter(change =>
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
      ),
  )

  if (_.isEmpty(policiesAndRulesChanges) || _.isEmpty(priorityChanges)) {
    return []
  }
  const policyOrRuleNametoChange = Object.fromEntries(
    policiesAndRulesChanges.map(policyOrRuleChange => {
      const instance = getChangeData(policyOrRuleChange.change)
      return [instance.elemID.getFullName(), policyOrRuleChange]
    }),
  )

  const priorityFullNameToPoliciesAndRulesChanges = Object.fromEntries(
    priorityChanges.map(priorityChange => {
      const instance = getChangeData(priorityChange.change)
      const policiesOrRules = instance.value.priorities
        .filter(isReferenceExpression)
        .map((ref: ReferenceExpression) => ref.elemID.getFullName())
        .map((refName: string) => policyOrRuleNametoChange[refName])
        .filter(isDefined)
      return [instance.elemID.getFullName(), policiesOrRules]
    }),
  )

  return priorityChanges.flatMap(priorityChange => {
    const fullName = getChangeData(priorityChange.change).elemID.getFullName()
    const policiesOrRules = priorityFullNameToPoliciesAndRulesChanges[fullName] ?? []
    return policiesOrRules
      .map((policyOrRuleChange: deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>>) =>
        createDependencyChange(policyOrRuleChange, priorityChange),
      )
      .flat()
  })
}
