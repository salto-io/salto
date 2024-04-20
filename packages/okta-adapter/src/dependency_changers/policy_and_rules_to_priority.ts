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
  dependencyChange,
  getChangeData,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { deployment } from '@salto-io/adapter-components'
import { POLICY_PRIORITY_TYPE_NAMES, POLICY_RULE_PRIORITY_TYPE_NAMES } from '../constants'
import { ALL_SUPPORTED_POLICY_NAMES, ALL_SUPPORTED_POLICY_RULE_NAMES } from '../filters/policy_priority'

const createDependencyChange = (
  policyOrPolicyRule: deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>>,
  priority: deployment.dependency.ChangeWithKey<ModificationChange<InstanceElement>>,
): DependencyChange[] => [dependencyChange('add', priority.key, policyOrPolicyRule.key)]

/*
 * This dependency changer is used to add a dependency from policy or policyRule priority instances
 * because we need the policy/policyRule to be deployed before its priority.
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
        ...ALL_SUPPORTED_POLICY_RULE_NAMES,
        ...POLICY_PRIORITY_TYPE_NAMES,
        ...POLICY_RULE_PRIORITY_TYPE_NAMES,
      ].includes(getChangeData(change.change).elemID.typeName),
    ),
    change =>
      [...ALL_SUPPORTED_POLICY_NAMES, ...ALL_SUPPORTED_POLICY_RULE_NAMES].includes(
        getChangeData(change.change).elemID.typeName,
      ),
  )

  if (_.isEmpty(policiesAndRulesChanges) || _.isEmpty(priorityChanges)) {
    return []
  }

  return policiesAndRulesChanges.flatMap(policyOrRuleChange =>
    priorityChanges.map(priorityChange => createDependencyChange(policyOrRuleChange, priorityChange)).flat(),
  )
}
