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
import { logger } from '@salto-io/logging'
import { Change, InstanceElement, isInstanceChange, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { POLICY_RULE_TYPE_NAMES } from '../constants'
import OktaClient from '../client/client'
import { OktaConfig, API_DEFINITIONS_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange } from '../deployment'

const log = logger(module)

const deployPolicyRuleRemoval = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  config: OktaConfig,
): Promise<void> => {
  try {
    await defaultDeployChange(change, client, config[API_DEFINITIONS_CONFIG])
    return
  } catch (error) {
    if (error instanceof clientUtils.HTTPError && error.response?.status === 404) {
      log.debug(`In policyRuleRemoval filter, ${getChangeData(change).elemID.getFullName()} was deleted and therefore marked as deployed`)
      return
    }
    throw error
  }
}

/**
 * Deploy policy rule removal changes.
 * When the parent policy removed, its policy rules are removed as well by Okta,
 * therefore, the filter catch the error we get for trying to delete non existing rules
 * and mark changes as deployed successfully.
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'policyRuleRemoval',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
        && isRemovalChange(change)
        && POLICY_RULE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => deployPolicyRuleRemoval(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
