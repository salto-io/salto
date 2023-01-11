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
import { Change, InstanceElement, isInstanceChange, getChangeData, isAdditionOrModificationChange, isModificationChange, ModificationChange, isAdditionChange, AdditionChange } from '@salto-io/adapter-api'
import { config as configUtils, elements as elementUtils, deployment } from '@salto-io/adapter-components'
import { APPLICATION_TYPE_NAME } from '../constants'
import OktaClient from '../client/client'
import { OktaConfig, API_DEFINITIONS_CONFIG } from '../config'
import { FilterCreator } from '../filter'
import { deployChanges, defaultDeployChange, deployEdges } from '../deployment'

const INACTIVE_STATUS = 'INACTIVE'
export const AUTO_LOGIN_APP = 'AUTO_LOGIN'
const APP_ASSIGNMENT_FIELDS: Record<string, configUtils.DeploymentRequestsByAction> = {
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
  const appStatus = instanceStatusAfter === INACTIVE_STATUS ? 'deactivate' : 'activate'
  const urlParams = { appId, appStatus }
  const url = elementUtils.replaceUrlParams('/api/v1/apps/{appId}/lifecycle/{appStatus}', urlParams)
  try {
    const response = await client.post({ url, data: {} })
    return response.data
  } catch (err) {
    throw new Error(`Application status could not be updated in instance: ${getChangeData(change).elemID.getFullName()}`)
  }
}

// Set fields that are created by the service to the returned app instance
const assignCreatedFieldsToApp = (
  change: AdditionChange<InstanceElement>,
  response: deployment.ResponseResult,
): void => {
  const instance = getChangeData(change)
  const signing = _.get(response, ['credentials', 'signing'])
  if (_.isPlainObject(signing)) {
    _.set(instance, ['value', 'credentials', 'signing'], signing)
  }
  if (instance.value.signOnMode === AUTO_LOGIN_APP) {
    const createdAppName = _.get(response, ['name'])
    if (_.isString(createdAppName)) {
      _.set(instance, ['value', 'name'], createdAppName)
    }
  }
  if (instance.value.licensing !== undefined) {
    const licensing = _.get(response, ['licensing'])
    if (_.isPlainObject(licensing)) {
      _.set(instance, ['value', 'licensing'], licensing)
    }
  }
}


// TODO SALTO-2736 : adjust to support addition of more application types
const deployApp = async (
  change: Change<InstanceElement>,
  client: OktaClient,
  config: OktaConfig,
): Promise<void> => {
  const getAdditionalFieldsToIgnore = (instance: InstanceElement): string[] =>
    (instance.value.signOnMode === AUTO_LOGIN_APP ? ['name'] : [])

  const fieldsToIgnore = [
    ...Object.keys(APP_ASSIGNMENT_FIELDS),
    // TODO SALTO-2690: remove this once completed
    'id', 'created', 'lastUpdated', 'status', 'licensing', '_links', '_embedded',
  ]

  if (isModificationChange(change)) {
    // application status must be deployed seperatly
    await deployAppStatusChange(change, client)
  }

  const response = await defaultDeployChange(
    change,
    client,
    config[API_DEFINITIONS_CONFIG],
    isAdditionChange(change)
      ? fieldsToIgnore.concat(getAdditionalFieldsToIgnore(getChangeData(change))) : fieldsToIgnore,
    isAdditionChange(change) && getChangeData(change).value.status === 'INACTIVE' ? { activate: 'false' } : undefined
  )

  if (isAdditionOrModificationChange(change)) {
    if (isAdditionChange(change)) {
      assignCreatedFieldsToApp(change, response)
    }
    await deployEdges(change, APP_ASSIGNMENT_FIELDS, client)
  }
}

/**
 * Application type is deployed separately to update application's status,
 * application's assigned group and application's policies
 */
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
