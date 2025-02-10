/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { getParents, invertNaclCase, naclCase, pathNaclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import {
  fetch,
  elements as adapterElements,
  client as clientUtils,
  definitions as definitionsUtils,
} from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import {
  ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
  ACCESS_POLICY_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  AUTHORIZATION_POLICY,
  AUTHORIZATION_POLICY_PRIORITY_TYPE_NAME,
  AUTHORIZATION_POLICY_RULE,
  AUTHORIZATION_POLICY_RULE_PRIORITY_TYPE_NAME,
  AUTHORIZATION_SERVER,
  IDP_POLICY_TYPE_NAME,
  IDP_RULE_PRIORITY_TYPE_NAME,
  IDP_RULE_TYPE_NAME,
  MFA_POLICY_PRIORITY_TYPE_NAME,
  MFA_POLICY_TYPE_NAME,
  MFA_RULE_PRIORITY_TYPE_NAME,
  MFA_RULE_TYPE_NAME,
  OKTA,
  PASSWORD_POLICY_PRIORITY_TYPE_NAME,
  PASSWORD_POLICY_TYPE_NAME,
  PASSWORD_RULE_PRIORITY_TYPE_NAME,
  PASSWORD_RULE_TYPE_NAME,
  SIGN_ON_POLICY_PRIORITY_TYPE_NAME,
  SIGN_ON_POLICY_TYPE_NAME,
  SIGN_ON_RULE_PRIORITY_TYPE_NAME,
  SIGN_ON_RULE_TYPE_NAME,
} from '../constants'
import { deployChanges } from '../deprecated_deployment'

const log = logger(module)
const { awu } = collections.asynciterable
const { replaceAllArgs } = fetch.request
export const POLICY_RULE_WITH_PRIORITY = [
  ACCESS_POLICY_RULE_TYPE_NAME,
  IDP_RULE_TYPE_NAME,
  MFA_RULE_TYPE_NAME,
  SIGN_ON_RULE_TYPE_NAME,
  PASSWORD_RULE_TYPE_NAME,
  AUTHORIZATION_POLICY_RULE,
  // not a policy rule, but managed similarly as there is a policy per authorization server
  AUTHORIZATION_POLICY,
]
const POLICY_WITH_PRIORITY = [SIGN_ON_POLICY_TYPE_NAME, MFA_POLICY_TYPE_NAME, PASSWORD_POLICY_TYPE_NAME] as const
export const ALL_SUPPORTED_POLICY_NAMES = POLICY_WITH_PRIORITY as readonly string[]
type PolicyTypeWithPriority = (typeof POLICY_WITH_PRIORITY)[number]

const isPolicyTypeWithPriority = (typeName: string): typeName is PolicyTypeWithPriority =>
  ALL_SUPPORTED_POLICY_NAMES.includes(typeName)

// Automation and ProfileEnrollmentPolicyRule is not included in the list of supported policy rules because it is not supported
const POLICY_NAME_TO_RULE_PRIORITY_NAME: Record<string, string> = {
  [ACCESS_POLICY_TYPE_NAME]: ACCESS_POLICY_RULE_PRIORITY_TYPE_NAME,
  [IDP_POLICY_TYPE_NAME]: IDP_RULE_PRIORITY_TYPE_NAME,
  [MFA_POLICY_TYPE_NAME]: MFA_RULE_PRIORITY_TYPE_NAME,
  [SIGN_ON_POLICY_TYPE_NAME]: SIGN_ON_RULE_PRIORITY_TYPE_NAME,
  [PASSWORD_POLICY_TYPE_NAME]: PASSWORD_RULE_PRIORITY_TYPE_NAME,
  [AUTHORIZATION_POLICY]: AUTHORIZATION_POLICY_RULE_PRIORITY_TYPE_NAME,
  [AUTHORIZATION_SERVER]: AUTHORIZATION_POLICY_PRIORITY_TYPE_NAME,
}

const POLICY_NAME_TO_PRIORITY_NAME: Record<PolicyTypeWithPriority, string> = {
  [SIGN_ON_POLICY_TYPE_NAME]: SIGN_ON_POLICY_PRIORITY_TYPE_NAME,
  [MFA_POLICY_TYPE_NAME]: MFA_POLICY_PRIORITY_TYPE_NAME,
  [PASSWORD_POLICY_TYPE_NAME]: PASSWORD_POLICY_PRIORITY_TYPE_NAME,
}

export const POLICY_PRIORITY_TYPE_NAMES = Object.values(POLICY_NAME_TO_PRIORITY_NAME)
export const POLICY_RULE_PRIORITY_TYPE_NAMES = Object.values(POLICY_NAME_TO_RULE_PRIORITY_NAME)

const createPriorityType = (typeName: string, defaultFieldName: string): ObjectType =>
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
  const parentPath = (policy.path ?? []).slice(0, -1)
  const path =
    policy.elemID.typeName === AUTHORIZATION_SERVER
      ? [...parentPath, 'policies', pathNaclCase(name)]
      : [...parentPath, pathNaclCase(name)]
  return new InstanceElement(name, type, fullValue, path, {
    [CORE_ANNOTATIONS.PARENT]: new ReferenceExpression(policy.elemID, policy),
  })
}

// For AccessPolicyRules, the priority index starts from 0, while for others it starts from 1.
const getPriorityValue = (typeName: string, priority: number): number =>
  typeName === ACCESS_POLICY_RULE_TYPE_NAME ? priority : priority + 1

export const getParentPolicy = (rule: InstanceElement): InstanceElement | undefined => {
  if (rule.elemID.typeName === AUTHORIZATION_POLICY_RULE) {
    return getParents(rule).find(parent => parent.elemID.typeName === AUTHORIZATION_POLICY)?.value
  }
  return getParents(rule)[0]?.value
}

// use polling to overcome edge case where the policy is not yet updated
const getWithPolling = async ({
  args,
  client,
}: {
  args: clientUtils.ClientBaseParams
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface
}): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> => {
  const pollingArgs: definitionsUtils.PollingArgs = {
    interval: 1000,
    retries: 3,
    checkStatus: response => response.status === 200,
    retryOnStatus: [404],
  }
  const clientGet = async ({
    url,
  }: clientUtils.ClientBaseParams): Promise<
    clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>
  > => client.get({ url })
  const res = await clientUtils.executeWithPolling(args, pollingArgs, clientGet)
  return res
}

const updatePriorityField = async ({
  client,
  requiredPriority,
  instance,
  deployPolicyPath,
  fieldsToOmit,
}: {
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface
  requiredPriority: number
  instance: InstanceElement
  deployPolicyPath: definitionsUtils.EndpointPath
  fieldsToOmit: string[]
}): Promise<void> => {
  const pathContext = {
    ...instance.value,
    parent_id: getParentPolicy(instance)?.value?.id,
    second_parent_id: getParents(instance)[1]?.value?.value.id, // only applies for AuthorizationServerPolicyRule
  }
  const { path } = replaceAllArgs({
    value: { path: deployPolicyPath },
    context: pathContext,
    throwOnUnresolvedArgs: true,
  })
  const response = await getWithPolling({ args: { url: path }, client })
  const fieldToUpdate = (Array.isArray(response.data) ? response.data[0] : response.data).priority
  if (fieldToUpdate === requiredPriority) {
    log.debug(
      `skipped updating priority field for ${instance.elemID.getFullName()}, priority is already set to ${requiredPriority}`,
    )
    return
  }
  const data = { ..._.omit(response.data, fieldsToOmit), priority: requiredPriority }
  try {
    await client.put({ url: path, data })
  } catch (error) {
    log.error(
      'Failed to update priority field for %s: with error %s',
      instance.elemID.getFullName(),
      safeJsonStringify(error),
    )
    throw error
  }
}

const getSinglePolicyPath = (typeName: string): definitionsUtils.EndpointPath => {
  switch (typeName) {
    case AUTHORIZATION_POLICY:
      return '/api/v1/authorizationServers/{parent_id}/policies/{id}'
    case AUTHORIZATION_POLICY_RULE:
      return '/api/v1/authorizationServers/{second_parent_id}/policies/{parent_id}/rules/{id}'
    case ACCESS_POLICY_RULE_TYPE_NAME:
    case IDP_RULE_TYPE_NAME:
    case MFA_RULE_TYPE_NAME:
    case SIGN_ON_RULE_TYPE_NAME:
    case PASSWORD_RULE_TYPE_NAME:
      return '/api/v1/policies/{parent_id}/rules/{id}'
    default:
      return '/api/v1/policies/{id}'
  }
}

/*
 * Manages the priorities of policies and policy rules by generating an InstanceElement
 * for the priorities. Each priority instance contains the instances sorted by their
 * priority, including the default instance. The default instance is always set to be
 * last.
 *
 * In deployment, we update the policy priorities by using a GET request to get the current policy data,
 * with a following PUT request to update the priority field only.
 */
const filter: FilterCreator = ({ definitions }) => ({
  name: 'policyPrioritiesFilter',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const policiesRules = instances.filter(instance => POLICY_RULE_WITH_PRIORITY.includes(instance.elemID.typeName))
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
      instances.filter(instance => isPolicyTypeWithPriority(instance.elemID.typeName)),
      instance => instance.elemID.typeName,
    )
    Object.entries(policyTypeNameToPolicies).forEach(([policyTypeName, policies]) => {
      if (!isPolicyTypeWithPriority(policyTypeName)) {
        return
      }
      logDuplicatePriorities(policies)
      const type = priorityTypeNameToPriorityType[POLICY_NAME_TO_PRIORITY_NAME[policyTypeName]]
      const priorityInstance = createPolicyPriorityInstance({
        policies,
        type,
        typeName: policyTypeName,
      })
      elements.push(priorityInstance)
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
      const fieldsToOmit = [...fetch.element.getFieldsToOmit(definitions, instance.elemID.typeName)]
      if (isAdditionChange(change)) {
        await awu(instance.value.priorities)
          .filter(isReferenceExpression)
          .forEach(async (ref, priority) => {
            const path = getSinglePolicyPath(ref.elemID.typeName)
            await updatePriorityField({
              client: definitions.clients.options.main.httpClient,
              requiredPriority: getPriorityValue(ref.elemID.typeName, priority),
              instance: ref.value,
              deployPolicyPath: path,
              fieldsToOmit,
            })
          })
      }
      if (isModificationChange(change) && instance.value.priorities !== undefined) {
        const positionsBefore = change.data.before.value.priorities.filter(isReferenceExpression)
        await awu(instance.value.priorities)
          .filter(isReferenceExpression)
          .forEach(async (ref, priority) => {
            if (positionsBefore[priority]?.elemID.getFullName() !== ref.elemID.getFullName()) {
              const path = getSinglePolicyPath(ref.elemID.typeName)
              await updatePriorityField({
                client: definitions.clients.options.main.httpClient,
                requiredPriority: getPriorityValue(ref.elemID.typeName, priority),
                instance: ref.value,
                deployPolicyPath: path,
                fieldsToOmit,
              })
            }
          })
      }
    })
    return { deployResult, leftoverChanges }
  },
})

export default filter
