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
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ListType,
  ObjectType,
  ReferenceExpression,
  isInstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { getParent, hasValidParent, invertNaclCase, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { FilterCreator } from '../filter'
import { OKTA, POLICY_RULE_PRIORITIES, POLICY_RULE_TYPE_NAMES, POLICY_TYPE_NAMES } from '../constants'

const createPrioritiesType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(OKTA, POLICY_RULE_PRIORITIES),
    fields: {
      rules: {
        refType: new ListType(BuiltinTypes.NUMBER),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
      },
    },
    path: [OKTA, adapterElements.TYPES_PATH, POLICY_RULE_PRIORITIES],
    annotations: {
      [CORE_ANNOTATIONS.CREATABLE]: true,
      [CORE_ANNOTATIONS.UPDATABLE]: true,
      [CORE_ANNOTATIONS.DELETABLE]: true,
    },
  })

const createPolicyRulePriorities = (
  rules: InstanceElement[],
  policyRulePrioritiesType: ObjectType,
  policy: InstanceElement,
): InstanceElement => {
const name = naclCase(`${policy.elemID.typeName}_${invertNaclCase(policy.elemID.name)}_Priorities`)
  return new InstanceElement(
    name,
    policyRulePrioritiesType,
    {
      rules: rules
        .sort((a, b) => a.value.position - b.value.position)
        .map(inst => new ReferenceExpression(inst.elemID, inst)),
    },
    [...(policy.path ?? []).slice(0, -1), pathNaclCase(name)],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(policy.elemID, policy)],
    },
  )
}

/* Manages the priorities of policyRules within each Policy
 * by generating an InstanceElement for the policyRules priorities.
 */
const filter: FilterCreator = () => ({
  name: 'policyRulePrioritiesFilter',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const policyInstanceToName = _.keyBy(
      instances.filter(e => POLICY_TYPE_NAMES.includes(e.elemID.typeName)),
      inst => inst.elemID.getFullName(),
    )
    const policiesRules = instances.filter(instance => POLICY_RULE_TYPE_NAMES.includes(instance.elemID.typeName))
    const policiesToRules = _.groupBy(policiesRules.filter(hasValidParent), rule =>
      getParent(rule).elemID.getFullName(),
    )
    const prioritiesType = createPrioritiesType()
    elements.push(prioritiesType)
    Object.entries(policiesToRules).forEach(([policyName, rules]) => {
      const prioritiesInstance = createPolicyRulePriorities(rules, prioritiesType, policyInstanceToName[policyName])
      elements.push(prioritiesInstance)
    })
    // Remove priority field from the policy rules
    policiesRules.forEach(rule => {
      delete rule.value.priority
    })
  },
})

export default filter
