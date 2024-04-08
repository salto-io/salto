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
  ElemIdGetter,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { getParents, invertNaclCase, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { fetch, elements as adapterElements, config as configUtils } from '@salto-io/adapter-components'
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
  POLICY_TYPE_NAMES,
  PROFILE_ENROLLMENT_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_PRIORITY_TYPE_NAME,
  SIGN_ON_POLICY_TYPE_NAME,
  SIGN_ON_RULE_PRIORITY_TYPE_NAME,
} from '../constants'
import { deployChanges } from '../deployment'
import OktaClient from '../client/client'
import { API_DEFINITIONS_CONFIG, OktaConfig } from '../config'

const { awu } = collections.asynciterable
const { createUrl } = fetch.resource
const { toBasicInstance } = adapterElements
const { getTransformationConfigByType } = configUtils

const ALL_SUPPORTED_POLICY_NAMES = POLICY_TYPE_NAMES.concat([AUTHORIZATION_POLICY])
const ALL_SUPPORTED_POLICY_RULE_NAMES = POLICY_RULE_TYPE_NAMES.concat([AUTHORIZATION_POLICY_RULE])
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
    path: undefined,
    annotations: {
      [CORE_ANNOTATIONS.CREATABLE]: true,
      [CORE_ANNOTATIONS.UPDATABLE]: true,
      [CORE_ANNOTATIONS.DELETABLE]: true,
    },
  })

const createPolicyRulePriorityInstance = ({
  rules,
  type,
  policy,
  getElemIdFunc,
  config,
}: {
  rules: InstanceElement[]
  type: ObjectType
  policy: InstanceElement
  getElemIdFunc?: ElemIdGetter
  config: OktaConfig
}): Promise<InstanceElement> => {
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

  return toBasicInstance({
    entry: fullValue,
    type,
    transformationConfigByType: getTransformationConfigByType(config[API_DEFINITIONS_CONFIG].types),
    transformationDefaultConfig: config[API_DEFINITIONS_CONFIG].typeDefaults.transformation,
    parent: policy,
    defaultName: name,
    nestedPath: [...(policy.path ?? []).slice(2, (policy.path ?? []).length - 1), pathNaclCase(name)],
    getElemIdFunc,
  })
}

// For AccessPolicy, the priority index starts from 1, while for others it starts from 0.
const setPriority = (typeName: string, priority: number): number => {
  if (typeName === ACCESS_POLICY_TYPE_NAME) {
    return priority
  }
  return priority + 1
}

const deployPriorityChange = async ({
  client,
  priority,
  rule,
  config,
}: {
  client: OktaClient
  priority: number
  rule: ReferenceExpression
  config: OktaConfig
}): Promise<void> => {
  const { id } = rule.value.value
  const { type } = rule.value.value
  const policy = getParents(rule.value)[0].value
  const policyId = policy.value.id
  const policyTypeName = policy.elemID.typeName
  const data = { priority: setPriority(policyTypeName, priority), type, name: rule.value.value.name }
  const typeDefinition = config.apiDefinitions.types[rule.elemID.typeName]
  const deployRequest = typeDefinition.deployRequests ? typeDefinition.deployRequests.modify : undefined
  const deployUrl = deployRequest?.url
  if (deployUrl === undefined) {
    throw new Error('Failed to deploy priority change due to missing url')
  }
  const url = createUrl({ instance: rule.value, url: deployUrl, additionalUrlVars: { ruleId: id, policyId } })

  await client.put({ url, data })
}

/* Manages the priorities of policyRules within each Policy
 * by generating an InstanceElement for the policyRules priorities.
 */
const filter: FilterCreator = ({ config, client, getElemIdFunc }) => ({
  name: 'policyRulePrioritiesFilter',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const policyNameToInstance = _.keyBy(
      instances.filter(e => ALL_SUPPORTED_POLICY_NAMES.includes(e.elemID.typeName)),
      inst => inst.elemID.getFullName(),
    )
    const policiesRules = instances.filter(instance =>
      ALL_SUPPORTED_POLICY_RULE_NAMES.includes(instance.elemID.typeName),
    )
    const policiesToPoliciesRules = _.groupBy(policiesRules.filter(rule => isReferenceExpression(getParents(rule)[0])), rule =>
      // AuthorizationServerPolicyRule has two parents. 
      getParents(rule)[0].elemID.getFullName(),
    )
    const priorityTypes = POLICY_RULE_PRIORITY_TYPE_NAMES.map(name => createPriorityType(name))
    priorityTypes.forEach(type => elements.push(type))
    const priorityNameToPriorityType = _.keyBy(priorityTypes, type => type.elemID.typeName)
    await awu(Object.entries(policiesToPoliciesRules)).forEach(async ([policyName, rules]) => {
      const type =
        priorityNameToPriorityType[POLICY_NAME_TO_PRIORITY_NAME[policyNameToInstance[policyName].elemID.typeName]]
      const priorityInstance = await createPolicyRulePriorityInstance({
        rules,
        type,
        policy: policyNameToInstance[policyName],
        getElemIdFunc,
        config,
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
              rule,
              config,
            })
          })
      }
      if (isModificationChange(change)) {
        const positionsBefore = change.data.before.value.priorities.filter(isReferenceExpression)
        await awu(instance.value.priorities)
          .filter(isReferenceExpression)
          .forEach(async (rule, priority) => {
            if (positionsBefore[priority]?.elemID.getFullName() !== rule.elemID.getFullName()) {
              await deployPriorityChange({
                client,
                priority,
                rule,
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
