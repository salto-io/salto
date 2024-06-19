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
import { fetch, elements as adapterElements, client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
  ACCESS_POLICY_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  AUTHORIZATION_POLICY,
  AUTHORIZATION_POLICY_RULE,
  AUTHORIZATION_POLICY_RULE_PRIORITY_TYPE_NAME,
  IDP_POLICY_TYPE_NAME,
  IDP_RULE_PRIORITY_TYPE_NAME,
  IDP_RULE_TYPE_NAME,
  MFA_POLICY_TYPE_NAME,
  MFA_RULE_PRIORITY_TYPE_NAME,
  MFA_RULE_TYPE_NAME,
  OKTA,
  PASSWORD_POLICY_TYPE_NAME,
  PASSWORD_RULE_PRIORITY_TYPE_NAME,
  PASSWORD_RULE_TYPE_NAME,
  POLICY_PRIORITY_TYPE_NAMES,
  POLICY_RULE_PRIORITY_TYPE_NAMES,
  SIGN_ON_POLICY_TYPE_NAME,
  SIGN_ON_RULE_PRIORITY_TYPE_NAME,
  SIGN_ON_RULE_TYPE_NAME,
} from '../constants'
import { deployChanges } from '../deployment'
import { API_DEFINITIONS_CONFIG, OktaSwaggerApiConfig } from '../config'

const log = logger(module)
const { awu } = collections.asynciterable
const { createUrl } = fetch.resource
export const POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE = [
  ACCESS_POLICY_RULE_TYPE_NAME,
  IDP_RULE_TYPE_NAME,
  MFA_RULE_TYPE_NAME,
  SIGN_ON_RULE_TYPE_NAME,
  PASSWORD_RULE_TYPE_NAME,
  AUTHORIZATION_POLICY_RULE,
]
export const ALL_SUPPORTED_POLICY_NAMES = [SIGN_ON_POLICY_TYPE_NAME, MFA_POLICY_TYPE_NAME, PASSWORD_POLICY_TYPE_NAME]
// Automation and PofileEnrollmentPolicyRule is not included in the list of supported policy rules because it is not supported
const POLICY_NAME_TO_RULE_PRIORITY_NAME: Record<string, string> = {
  [ACCESS_POLICY_TYPE_NAME]: ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
  [IDP_POLICY_TYPE_NAME]: IDP_RULE_PRIORITY_TYPE_NAME,
  [MFA_POLICY_TYPE_NAME]: MFA_RULE_PRIORITY_TYPE_NAME,
  [SIGN_ON_POLICY_TYPE_NAME]: SIGN_ON_RULE_PRIORITY_TYPE_NAME,
  [PASSWORD_POLICY_TYPE_NAME]: PASSWORD_RULE_PRIORITY_TYPE_NAME,
  [AUTHORIZATION_POLICY]: AUTHORIZATION_POLICY_RULE_PRIORITY_TYPE_NAME,
}

const POLICY_NAME_TO_PRIORITY_NAME: Record<string, string> = {
  [SIGN_ON_POLICY_TYPE_NAME]: 'OktaSignOnPolicyPriority',
  [MFA_POLICY_TYPE_NAME]: 'MultifactorEnrollmentPolicyPriority',
  [PASSWORD_POLICY_TYPE_NAME]: 'PasswordPolicyPriority',
}
export const createPriorityType = (typeName: string, defaultFieldName: string): ObjectType =>
  new ObjectType({
    elemID: new ElemID(OKTA, typeName),
    fields: {
      priorities: {
        refType: new ListType(BuiltinTypes.NUMBER),
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true, [CORE_ANNOTATIONS.UPDATABLE]: true },
      },
      [defaultFieldName]: {
        refType: BuiltinTypes.STRING,
        annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
      },
    },
    path: [OKTA, adapterElements.TYPES_PATH, typeName],
  })
const logDuplicatePriorities = (instances: InstanceElement[]): void => {
  const instanceByPriority = _.groupBy(instances, inst => inst.value.priority)
  Object.entries(instanceByPriority).forEach(([priority, insts]) => {
    if (Array.isArray(insts) && insts.length > 1) {
      log.error(
        `Duplicate priorities found for ${insts.map(inst => inst.elemID.getFullName())} with priority ${priority}`,
      )
    }
  })
}

const createPolicyPriorityInstance = ({
  policies,
  type,
  typeName,
}: {
  policies: InstanceElement[]
  type: ObjectType
  typeName: string
}): InstanceElement => {
  const name = naclCase(`${typeName}_priority`)
  const defaultPolicy = policies.find(policy => policy.value.system === true)
  const value = {
    priorities: policies
      .filter(policy => policy.value.system !== true)
      .sort((a, b) => a.value.priority - b.value.priority)
      .map(inst => new ReferenceExpression(inst.elemID, inst)),
  }
  const fullValue = defaultPolicy
    ? { ...value, defaultPolicy: new ReferenceExpression(defaultPolicy.elemID, defaultPolicy) }
    : value
  return new InstanceElement(name, type, fullValue, [OKTA, 'Records', typeName, pathNaclCase(name)])
}

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

// For AccessPolicyRules, the priority index starts from 0, while for others it starts from 1.
const setPriority = (typeName: string, priority: number): number => {
  if (typeName === ACCESS_POLICY_RULE_TYPE_NAME) {
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
  instance,
  apiDefinitions,
  additionalUrlVars,
}: {
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface
  priority: number
  instance: InstanceElement
  apiDefinitions: OktaSwaggerApiConfig
  additionalUrlVars: Record<string, string>
}): Promise<void> => {
  const { type } = instance.value
  const ruleTypeName = instance.elemID.typeName
  const baseData = { priority: setPriority(ruleTypeName, priority), type, name: instance.value.name }
  // For sign on rules, we need to include the actions in the data
  const data =
    instance.elemID.typeName === SIGN_ON_RULE_TYPE_NAME ? { ...baseData, actions: instance.value.actions } : baseData
  const typeDefinition = apiDefinitions.types[instance.elemID.typeName]
  const deployRequest = typeDefinition.deployRequests ? typeDefinition.deployRequests.modify : undefined
  const deployUrl = deployRequest?.url
  if (deployUrl === undefined) {
    throw new Error('Failed to deploy priority change due to missing url')
  }
  const url = createUrl({ instance, url: deployUrl, additionalUrlVars })

  await client.put({ url, data })
}

const getAdditionalUrlVars = (instance: InstanceElement): Record<string, string> =>
  POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE.includes(instance.elemID.typeName)
    ? { ruleId: instance.value.id, policyId: getParentPolicy(instance)?.value.id }
    : { policyId: instance.value.id }

/*
 * Manages the priorities of policies and policy rules by generating an InstanceElement
 * for the priorities. Each priority instance contains the instances sorted by their
 * priority, including the default instance. The default instance is always set to be
 * last. In deployment, we deploy the priorities, not the instances themselves.
 */
const filter: FilterCreator = ({ definitions, oldApiDefinitions }) => ({
  name: 'policyPrioritiesFilter',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const policiesRules = instances.filter(instance =>
      POLICY_RULE_TYPES_WITH_PRIORITY_INSTANCE.includes(instance.elemID.typeName),
    )
    const priorityTypes = POLICY_RULE_PRIORITY_TYPE_NAMES.map(name => createPriorityType(name, 'defaultRule')).concat(
      POLICY_PRIORITY_TYPE_NAMES.map(name => createPriorityType(name, 'defaultPolicy')),
    )
    priorityTypes.forEach(type => elements.push(type))
    const priorityTypeNameToPriorityType = _.keyBy(priorityTypes, type => type.elemID.typeName)
    // Responsible for creating the priority instances for the policy rules
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
    policyAndRules.forEach(({ policy, rules }) => {
      logDuplicatePriorities(rules)
      const type = priorityTypeNameToPriorityType[POLICY_NAME_TO_RULE_PRIORITY_NAME[policy.elemID.typeName]]
      const priorityInstance = createPolicyRulePriorityInstance({
        rules,
        type,
        policy,
      })
      elements.push(priorityInstance)
    })
    // Responsible for creating the priority instances for the policies
    const policyTypeNameToPolicies = _.groupBy(
      instances.filter(instance => ALL_SUPPORTED_POLICY_NAMES.includes(instance.elemID.typeName)),
      instance => instance.elemID.typeName,
    )
    Object.entries(policyTypeNameToPolicies).forEach(([policyTypeName, policies]) => {
      logDuplicatePriorities(policies)
      const type = priorityTypeNameToPriorityType[POLICY_NAME_TO_PRIORITY_NAME[policyTypeName]]
      const priorityInstance = createPolicyPriorityInstance({
        policies,
        type,
        typeName: policyTypeName,
      })
      elements.push(priorityInstance)
    })
    // Remove priority field from the instances
    policiesRules.concat(Object.values(policyTypeNameToPolicies).flat()).forEach(rule => {
      delete rule.value.priority
    })
  },
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(changes, change =>
      POLICY_RULE_PRIORITY_TYPE_NAMES.concat(POLICY_PRIORITY_TYPE_NAMES).includes(
        getChangeData(change).elemID.typeName,
      ),
    )
    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      const instance = getChangeData(change)
      if (isAdditionChange(change)) {
        await awu(instance.value.priorities)
          .filter(isReferenceExpression)
          .forEach(async (ref, priority) => {
            await deployPriorityChange({
              client: definitions.clients.options.main.httpClient,
              priority,
              instance: ref.value,
              apiDefinitions: oldApiDefinitions[API_DEFINITIONS_CONFIG],
              additionalUrlVars: getAdditionalUrlVars(ref.value),
            })
          })
      }
      if (isModificationChange(change) && instance.value.priorities !== undefined) {
        const positionsBefore = change.data.before.value.priorities.filter(isReferenceExpression)
        await awu(instance.value.priorities)
          .filter(isReferenceExpression)
          .forEach(async (ref, priority) => {
            if (positionsBefore[priority]?.elemID.getFullName() !== ref.elemID.getFullName()) {
              await deployPriorityChange({
                client: definitions.clients.options.main.httpClient,
                priority,
                instance: ref.value,
                apiDefinitions: oldApiDefinitions[API_DEFINITIONS_CONFIG],
                additionalUrlVars: getAdditionalUrlVars(ref.value),
              })
            }
          })
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filter
