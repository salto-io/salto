/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Change, InstanceElement, isInstanceChange, getChangeData, isAdditionChange, isAdditionOrModificationChange, isModificationChange, ModificationChange } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, deployment } from '@salto-io/adapter-components'
import { APPLICATION_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { OktaConfig, API_DEFINITIONS_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange, deployEdges } from '../deployment'

const APP_ASSIGNMENT_FIELDS: Record<string, configUtils.DeploymentRequestsByAction> = {
  appUsers: {
    add: {
      url: '/api/v1/apps/{source}/users/{target}',
      method: 'put',
    },
    remove: {
      url: '/api/v1/apps/{source}/users/{target}',
      method: 'delete',
    },
  },
  assignedGroups: {
    add: {
      url: '/api/v1/apps/{source}/groups/{target}',
      method: 'put',
    },
    remove: {
      url: '/api/v1/apps/{source}/groups/{target}',
      method: 'delete',
    },
  },
  profileEnrollment: {
    add: {
      url: '/api/v1/apps/{source}/policies/{target}',
      method: 'put',
    },
  },
  accessPolicy: {
    add: {
      url: '/api/v1/apps/{source}/policies/{target}',
      method: 'put',
    },
  },
}

const deployAppStatusChange = async (
  change: ModificationChange<InstanceElement>,
  client: OktaClient,
): Promise<deployment.ResponseResult> => {
  const appId = getChangeData(change).value.id
  const instanceStatusBefore = change.data.before.value.status
  const instanceStatusAfter = change.data.after.value.status
  if (instanceStatusBefore === instanceStatusAfter) {
    return undefined
  }
  const appStatus = instanceStatusAfter === 'INACTIVE' ? 'deactivate' : 'activate'
  const urlParams = { appId, appStatus }
  const url = elementUtils.replaceUrlParams('/api/v1/apps/{appId}/lifecycle/{appStatus}', urlParams)
  try {
    const response = await client.post({ url, data: {} })
    return response.data
  } catch (err) {
    throw new Error(`Application status could not be updated in instance: ${getChangeData(change).elemID.getFullName()}`)
  }
}

const deployApp = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  config: OktaConfig,
): Promise<void> => {
  const fieldsToIgnore = [
    ...Object.keys(APP_ASSIGNMENT_FIELDS),
    // TODO remove this once we update addDeploymentAnnotationsFromSwagger
    'id', 'created', 'lastUpdated', 'status', 'licensing', '_links', '_embedded',
  ]

  if (isAdditionChange(change)) {
    const instance = getChangeData(change)
    // In case of inactive app we need to update the query params
    if (instance.value.status === 'INACTIVE') {
      const appAdditionUrl = config[API_DEFINITIONS_CONFIG]
        .types[APPLICATION_TYPE_NAME].deployRequests?.add?.url
        appAdditionUrl?.concat('?activate=false')
    }
  }
  if (isModificationChange(change)) {
    // application status must be deployed seperatly
    await deployAppStatusChange(change, client)
  }

  await defaultDeployChange(change, client, config[API_DEFINITIONS_CONFIG], fieldsToIgnore)

  if (isAdditionOrModificationChange(change)) {
    await deployEdges(change, APP_ASSIGNMENT_FIELDS, client)
  }
}

const filterCreator: FilterCreator = ({ client, config }) => ({
  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change)
            && getChangeData(change).elemID.typeName === APPLICATION_TYPE_NAME
    )

    const deployResult = await deployChanges(
      relevantChanges.filter(isInstanceChange),
      async change => deployApp(change, client, config)
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filterCreator
