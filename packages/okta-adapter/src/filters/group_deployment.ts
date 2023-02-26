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
import { Change, InstanceElement, isInstanceChange, getChangeData, isRemovalChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { config as configUtils } from '@salto-io/adapter-components'
import { GROUP_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { OktaConfig, API_DEFINITIONS_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange, deployEdges } from '../deployment'

const GROUP_ASSIGNMENT_FIELDS: Record<string, configUtils.DeploymentRequestsByAction> = {
  roles: {
    // TODO SALTO-2743 add role addition deploy request
    remove: {
      url: '/api/v1/groups/{source}/roles/{target}',
      method: 'delete',
    },
  },
}

const deployGroup = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  config: OktaConfig,
): Promise<void> => {
  const fieldsToIgnore = [
    ...Object.keys(GROUP_ASSIGNMENT_FIELDS),
    // TODO SALTO-2690: remove this once completed
    'id', 'created', 'lastUpdated', 'objectClass', 'type', '_links', '_embedded', 'lastMembershipUpdated',
  ]
  if (isRemovalChange(change)) {
    fieldsToIgnore.push('profile')
  }
  await defaultDeployChange(change, client, config[API_DEFINITIONS_CONFIG], fieldsToIgnore)
  if (isAdditionOrModificationChange(change)) {
    await deployEdges(change, GROUP_ASSIGNMENT_FIELDS, client)
  }
}

/**
 * Group type is deployed separately to update group's roles
 */
const filterCreator: FilterCreator = ({ client, config }) => ({
  name: 'groupDeploymentFilter',
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
            && getChangeData(change).elemID.typeName === GROUP_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => deployGroup(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
