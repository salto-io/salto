/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Change, InstanceElement, isInstanceChange, getChangeData, isAdditionChange, toChange } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { getParents } from '@salto-io/adapter-utils'
import { ACCESS_POLICY_RULE_TYPE_NAME, PROFILE_ENROLLMENT_RULE_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { OktaConfig, API_DEFINITIONS_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange } from '../deployment'

const log = logger(module)

type PolicyRule = {
    id: string
    system: boolean
}

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
  client: OktaClient,
): Promise<PolicyRule> => {
  const url = `/api/v1/policies/${policyId}/rules`
  const ruleEntries = (await client.getSinglePage({ url })).data
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
  config: OktaConfig,
): InstanceElement => {
  const createdPolicyRuleInstance = defaultPolicyRuleInstance.clone()
  const apiDefs = config[API_DEFINITIONS_CONFIG]
  const { fieldsToOmit } = configUtils.getTypeTransformationConfig(
    createdPolicyRuleInstance.elemID.typeName,
    apiDefs.types,
    apiDefs.typeDefaults,
  )
  createdPolicyRuleInstance.value = _.omit(
    policyRuleEntry,
    (fieldsToOmit ?? []).map(field => field.fieldName)
  )
  return createdPolicyRuleInstance
}

const deployDefaultPolicy = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  config: OktaConfig,
): Promise<void> => {
  const defaultRuleInstance = getChangeData(change)
  const parentPolicyId = getParents(defaultRuleInstance)?.[0]?.id
  if (parentPolicyId === undefined) {
    log.error(`Error while trying to get parent id for policy rule ${defaultRuleInstance.elemID.getFullName()}`)
    throw new Error(`Could not find parent policy id for policy rule ${defaultRuleInstance.elemID.name} from type ${defaultRuleInstance.elemID.typeName}`)
  }
  const createdPolicyRuleEntry = await getDefaultPolicyRuleEntry(parentPolicyId, client)
  // Assign the id created by the service to the default policy rule
  defaultRuleInstance.value.id = createdPolicyRuleEntry.id
  const createdPolicyRuleInstance = getCreatedPolicyRuleInstance(createdPolicyRuleEntry, defaultRuleInstance, config)
  await defaultDeployChange(
    toChange({ before: createdPolicyRuleInstance, after: defaultRuleInstance }),
    client,
    config[API_DEFINITIONS_CONFIG]
  )
}

/**
 * Deploy addition changes of default rules for AccessPolicy and ProfileEnrollmentPolicy
 * by changing them to modification changes, because default rules automatically created by the service
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'defaultPolicyRuleDeployment',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isAdditionChange(change)
        && [ACCESS_POLICY_RULE_TYPE_NAME, PROFILE_ENROLLMENT_RULE_TYPE_NAME]
          .includes(getChangeData(change).elemID.typeName)
        && getChangeData(change).value.system === true
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => deployDefaultPolicy(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
