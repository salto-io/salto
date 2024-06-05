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
import _ from 'lodash'
import Joi from 'joi'
import {
  Change,
  InstanceElement,
  isInstanceChange,
  getChangeData,
  isAdditionChange,
  toChange,
  isAdditionOrModificationChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { client as clientUtils, definitions as definitionsUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, getParents } from '@salto-io/adapter-utils'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  ACCESS_POLICY_TYPE_NAME,
  MFA_POLICY_TYPE_NAME,
  PROFILE_ENROLLMENT_RULE_TYPE_NAME,
} from '../constants'
import { API_DEFINITIONS_CONFIG, OktaSwaggerApiConfig } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployWithStatus } from '../deployment'
import { OktaFetchOptions } from '../definitions/types'

const log = logger(module)
const { awu } = collections.asynciterable

type PolicyRule = {
  id: string
  system: boolean
}
type PolicyResponse = {
  data: {
    priority: number
  }
}
const POLICY_RESPONSE_SCHEMA = Joi.object({
  data: Joi.object({
    priority: Joi.number().required(),
  })
    .required()
    .unknown(true),
}).unknown(true)

const isPolicyResponse = createSchemeGuard<PolicyResponse>(POLICY_RESPONSE_SCHEMA)

const SUPPORTED_RULE_TYPES = [ACCESS_POLICY_RULE_TYPE_NAME, PROFILE_ENROLLMENT_RULE_TYPE_NAME]
const SUPPORT_POLICY_TYPES = [ACCESS_POLICY_TYPE_NAME]

const EXPECTED_POLICY_RULE_SCHEMA = Joi.object({
  id: Joi.string().required(),
  system: Joi.boolean().required(),
}).unknown(true)

const EXPECTED_POLICY_RULES_RESPONSE = Joi.array().items(EXPECTED_POLICY_RULE_SCHEMA).required()

const isRulesResponse = (values: unknown): values is PolicyRule[] => {
  const { error } = EXPECTED_POLICY_RULES_RESPONSE.validate(values)
  if (error !== undefined) {
    log.warn('Received an invalid response for the policy rules')
    return false
  }
  return true
}

const getDefaultPolicyRuleEntry = async (
  policyId: string,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
): Promise<PolicyRule> => {
  const url = `/api/v1/policies/${policyId}/rules`
  const ruleEntries = (await client.get({ url })).data
  if (!isRulesResponse(ruleEntries)) {
    log.error(`Recieved invalid policy rule response from endpoint: ${url}`)
    throw new Error('Invalid policy rules response')
  }
  const defaultRuleEntry = ruleEntries.find(rule => rule.system)
  if (defaultRuleEntry === undefined) {
    log.error('Failed to find the default policy rule')
    throw new Error('Could not find the default policy rule')
  }
  return defaultRuleEntry
}

const getCreatedPolicyRuleInstance = (
  policyRuleEntry: PolicyRule,
  defaultPolicyRuleInstance: InstanceElement,
  fieldsToOmit: string[] = [],
): InstanceElement => {
  const createdPolicyRuleInstance = defaultPolicyRuleInstance.clone()
  createdPolicyRuleInstance.value = _.omit(policyRuleEntry, fieldsToOmit)
  return createdPolicyRuleInstance
}

const deployDefaultPolicy = async (
  change: Change<InstanceElement>,
  client: clientUtils.HTTPWriteClientInterface & clientUtils.HTTPReadClientInterface,
  defQuery: definitionsUtils.DefQuery<definitionsUtils.fetch.InstanceFetchApiDefinitions<OktaFetchOptions>, string>,
  apiDefinitions: OktaSwaggerApiConfig,
): Promise<void> => {
  const defaultRuleInstance = getChangeData(change)
  const parentPolicyId = getParents(defaultRuleInstance)?.[0]?.id
  if (parentPolicyId === undefined) {
    log.error(`Error while trying to get parent id for policy rule ${defaultRuleInstance.elemID.getFullName()}`)
    throw new Error(
      `Could not find parent policy id for policy rule ${defaultRuleInstance.elemID.name} from type ${defaultRuleInstance.elemID.typeName}`,
    )
  }
  const createdPolicyRuleEntry = await getDefaultPolicyRuleEntry(parentPolicyId, client)
  const fieldsToOmit = _.pickBy(
    defQuery.query(defaultRuleInstance.elemID.typeName)?.element?.fieldCustomizations ?? {},
    f => f.omit,
  )

  // Assign the id created by the service to the default policy rule
  defaultRuleInstance.value.id = createdPolicyRuleEntry.id
  const createdPolicyRuleInstance = getCreatedPolicyRuleInstance(
    createdPolicyRuleEntry,
    defaultRuleInstance,
    Object.keys(fieldsToOmit),
  )
  await defaultDeployWithStatus(
    toChange({ before: createdPolicyRuleInstance, after: defaultRuleInstance }),
    client,
    apiDefinitions,
  )
}

/**
 * Deploy addition changes of default rules for AccessPolicy and ProfileEnrollmentPolicy
 * by changing them to modification changes, because default rules automatically created by the service
 * Also, set the priority of the default rules before deployment
 */
const filterCreator: FilterCreator = ({ definitions, oldApiDefinitions }) => ({
  name: 'defaultPolicyRuleDeployment',
  preDeploy: async changes => {
    const instanceChanges = changes.filter(isInstanceChange)
    await awu(instanceChanges)
      .filter(isModificationChange)
      .filter(
        change =>
          getChangeData(change).elemID.typeName === MFA_POLICY_TYPE_NAME && getChangeData(change).value.system === true,
      )
      .map(change => getChangeData(change))
      .forEach(async instance => {
        const response = await definitions.clients.options.main.httpClient.get({
          url: `/api/v1/policies/${instance.value.id}`,
        })
        if (isPolicyResponse(response)) {
          instance.value.priority = response.data.priority
        }
      })

    instanceChanges
      .filter(isAdditionOrModificationChange)
      .filter(
        change =>
          SUPPORTED_RULE_TYPES.concat(SUPPORT_POLICY_TYPES).includes(getChangeData(change).elemID.typeName) &&
          getChangeData(change).value.system === true,
      )
      .map(change => getChangeData(change))
      .forEach(instance => {
        if (instance.elemID.typeName === ACCESS_POLICY_TYPE_NAME) {
          // service default priority for AccessPolicy is 1
          instance.value.priority = 1
        } else {
          // service default priority for AccessPolicyRule and ProfileEnrollmentRule is 99
          instance.value.priority = 99
        }
      })
  },
  deploy: async changes => {
    const client = definitions.clients.options.main.httpClient
    const defQuery = definitionsUtils.queryWithDefault(definitions.fetch?.instances ?? {})
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change =>
        isInstanceChange(change) &&
        isAdditionChange(change) &&
        SUPPORTED_RULE_TYPES.includes(getChangeData(change).elemID.typeName) &&
        getChangeData(change).value.system === true,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change =>
      deployDefaultPolicy(change, client, defQuery, oldApiDefinitions[API_DEFINITIONS_CONFIG]),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
  onDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(
        change =>
          SUPPORTED_RULE_TYPES.concat(SUPPORT_POLICY_TYPES).includes(getChangeData(change).elemID.typeName) &&
          getChangeData(change).value.system === true,
      )
      .map(change => getChangeData(change))
      .forEach(instance => {
        delete instance.value.priority
      })
  },
})

export default filterCreator
