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
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isInstanceElement,
  isModificationChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { getParents, invertNaclCase, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { fetch, elements as adapterElements } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  AUTHORIZATION_POLICY,
  AUTHORIZATION_POLICY_RULE,
  AUTHORIZATION_POLICY_RULE_PRIORITY_TYPE_NAME,
  IDP_POLICY_TYPE_NAME,
  IDP_RULE_PRIORITY_TYPE_NAME,
  MFA_POLICY_TYPE_NAME,
  MFA_RULE_PRIORITY_TYPE_NAME,
  OKTA,
  PASSWORD_POLICY_TYPE_NAME,
  PASSWORD_RULE_PRIORITY_TYPE_NAME,
  POLICY_RULE_PRIORITY_TYPE_NAMES,
  POLICY_RULE_TYPE_NAMES,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_PRIORITY_TYPE_NAME,
  SIGN_ON_POLICY_TYPE_NAME,
  SIGN_ON_RULE_PRIORITY_TYPE_NAME,
} from '../constants'
import { deployChanges } from '../deployment'
import OktaClient from '../client/client'
import { OktaConfig } from '../config'

const log = logger(module)
const { awu } = collections.asynciterable
const { createUrl } = fetch.resource
const ALL_SUPPORTED_POLICY_RULE_NAMES = POLICY_RULE_TYPE_NAMES.concat([AUTHORIZATION_POLICY_RULE])
// Automation is not included in the list of supported policy rules because it is not supported
const POLICY_NAME_TO_PRIORITY_NAME: Record<string, string> = {
  [ACCESS_POLICY_TYPE_NAME]: ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
  [IDP_POLICY_TYPE_NAME]: IDP_RULE_PRIORITY_TYPE_NAME,
  [MFA_POLICY_TYPE_NAME]: MFA_RULE_PRIORITY_TYPE_NAME,
  [SIGN_ON_POLICY_TYPE_NAME]: SIGN_ON_RULE_PRIORITY_TYPE_NAME,
  [PASSWORD_POLICY_TYPE_NAME]: PASSWORD_RULE_PRIORITY_TYPE_NAME,
  [PROFILE_ENROLLMENT_POLICY_TYPE_NAME]: PROFILE_ENROLLMENT_RULE_PRIORITY_TYPE_NAME,
  [AUTHORIZATION_POLICY]: AUTHORIZATION_POLICY_RULE_PRIORITY_TYPE_NAME,
}

const createPriorityType = (typeName: string): ObjectType =>
  new ObjectType({
    elemID: new ElemID(OKTA, typeName),
    fields: {
      priorities: {
        refType: new ListType(BuiltinTypes.NUMBER),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
      },
      defaultValue: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
      },
    },
    path: [OKTA, adapterElements.TYPES_PATH, typeName],
  })

const createPolicyRulePriorityInstance = ({
  rules,
  type,
  policy,
}: {
  rules: InstanceElement[]
  type: ObjectType
  policy: InstanceElement
}): InstanceElement => {
  const name = naclCase(`${invertNaclCase(policy.elemID.name)}_priority`)
  const defaultRule = rules.find(rule => rule.value.system === true)
  const value = {
    priorities: rules
      .filter(rule => rule.value.system !== true)
      .sort((a, b) => a.value.priority - b.value.priority)
      .map(inst => new ReferenceExpression(inst.elemID, inst)),
  }
  const fullValue = defaultRule
    ? { ...value, defaultRule: new ReferenceExpression(defaultRule.elemID, defaultRule) }
    : value
  return new InstanceElement(name, type, fullValue, [...(policy.path ?? []).slice(0, -1), pathNaclCase(name)], {
    [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(policy.elemID, policy),
  })
}

// For AccessPolicy, the priority index starts from 1, while for others it starts from 0.
const setPriority = (typeName: string, priority: number): number => {
  if (typeName === ACCESS_POLICY_TYPE_NAME) {
    return priority
  }
  return priority + 1
}

const getParentPolicy = (rule: InstanceElement): InstanceElement | undefined => {
  if (rule.elemID.typeName === AUTHORIZATION_POLICY_RULE) {
    return getParents(rule).find(parent => parent.elemID.typeName === AUTHORIZATION_POLICY)?.value
  }
  return getParents(rule)[0]?.value
}

const deployPriorityChange = async ({
  client,
  priority,
  rule,
  config,
}: {
  client: OktaClient
  priority: number
  rule: InstanceElement
  config: OktaConfig
}): Promise<void> => {
  const { id } = rule.value
  const { type } = rule.value
  const policy = getParentPolicy(rule)
  if (policy === undefined) {
    throw new Error('Failed to deploy priority change due to missing policy')
  }
  const policyId = policy.value.id
  const policyTypeName = policy.elemID.typeName
  const data = { priority: setPriority(policyTypeName, priority), type, name: rule.value.name }
  const typeDefinition = config.apiDefinitions.types[rule.elemID.typeName]
  const deployRequest = typeDefinition.deployRequests ? typeDefinition.deployRequests.modify : undefined
  const deployUrl = deployRequest?.url
  if (deployUrl === undefined) {
    throw new Error('Failed to deploy priority change due to missing url')
  }
  const url = createUrl({ instance: rule, url: deployUrl, additionalUrlVars: { ruleId: id, policyId } })

  await client.put({ url, data })
}

/*
 * Manages the priorities of policy rules within each Policy by generating an InstanceElement
 * for the policy rules' priorities. Each priority instance contains the policy rules sorted
 * by their priority, including the default rule. The default rule is always set to be last.
 * In deployment, we deploy the priorities, not the policy rules themselves.
 */
const filter: FilterCreator = ({ config, client }) => ({
  name: 'policyRulePrioritiesFilter',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const policiesRules = instances.filter(instance =>
      ALL_SUPPORTED_POLICY_RULE_NAMES.includes(instance.elemID.typeName),
    )
    const policyAndRules = Object.values(
      policiesRules.reduce(
        (acc, rule) => {
          const policy = getParentPolicy(rule)
          if (!isInstanceElement(policy)) {
            log.warn('Policy not found for rule %s', rule.elemID.getFullName())
            return acc
          }
          const policyName = policy.elemID.getFullName()
          if (!acc[policyName]) {
            acc[policyName] = { policy, rules: [] }
          }
          acc[policyName].rules.push(rule)
          return acc
        },
        {} as {
          [key: string]: {
            policy: InstanceElement
            rules: InstanceElement[]
          }
        },
      ),
    )
    const priorityTypes = POLICY_RULE_PRIORITY_TYPE_NAMES.map(name => createPriorityType(name))
    priorityTypes.forEach(type => elements.push(type))
    const priorityNameToPriorityType = _.keyBy(priorityTypes, type => type.elemID.typeName)
    policyAndRules.forEach(({ policy, rules }) => {
      const type = priorityNameToPriorityType[POLICY_NAME_TO_PRIORITY_NAME[policy.elemID.typeName]]
      const priorityInstance = createPolicyRulePriorityInstance({
        rules,
        type,
        policy,
      })
      elements.push(priorityInstance)
    })
    // Remove priority field from the policy rules
    policiesRules.forEach(rule => {
      delete rule.value.priority
    })
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(changes, change =>
      POLICY_RULE_PRIORITY_TYPE_NAMES.includes(getChangeData(change).elemID.typeName),
    )
    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const instance = getChangeData(change)
      if (isAdditionChange(change)) {
        await awu(instance.value.priorities)
          .filter(isReferenceExpression)
          .forEach(async (rule, priority) => {
            await deployPriorityChange({
              client,
              priority,
              rule: rule.value,
              config,
            })
          })
      }
      if (isModificationChange(change) && instance.value.priorities !== undefined) {
        const positionsBefore = change.data.before.value.priorities.filter(isReferenceExpression)
        await awu(instance.value.priorities)
          .filter(isReferenceExpression)
          .forEach(async (rule, priority) => {
            if (positionsBefore[priority]?.elemID.getFullName() !== rule.elemID.getFullName()) {
              await deployPriorityChange({
                client,
                priority,
                rule: rule.value,
                config,
              })
            }
          })
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filter
