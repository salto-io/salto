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
import {
  Change, ChangeDataType, DeployResult, getChangeData, InstanceElement, isAdditionChange, Values,
} from '@salto-io/adapter-api'
import {
  config as configUtils, deployment, client as clientUtils,
} from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { collections, promises } from '@salto-io/lowerdash'
import ZendeskClient from './client/client'
import { getZendeskError } from './errors'
import { ZendeskApiConfig } from './config'

const { sleep } = promises.timeout
const { getRetryDelayFromHeaders } = clientUtils

const log = logger(module)
const { awu } = collections.asynciterable
const DEPLOYMENT_BUFFER_TIME = 500 // This seems to be about the optimal wait time (the least errors and shortest time)
const MAX_RETRIES = 5
// Those error codes are not related to the deployment data, and a retry should work
const RESPONSES_TO_RETRY = [409, 503]

export const addId = ({
  change, apiDefinitions, response, dataField, addAlsoOnModification = false,
}: {
  change: Change<InstanceElement>
  apiDefinitions: configUtils.AdapterApiConfig
  response: deployment.ResponseResult
  dataField?: string
  addAlsoOnModification?: boolean
}): void => {
  const { transformation } = apiDefinitions
    .types[getChangeData(change).elemID.typeName]
  if (isAdditionChange(change) || addAlsoOnModification) {
    if (Array.isArray(response)) {
      log.warn(
        'Received an array for the response of the deploy. Not updating the id of the element. Action: add. ID: %s',
        getChangeData(change).elemID.getFullName()
      )
      return
    }
    const transformationConfig = configUtils.getConfigWithDefault(
      transformation,
      apiDefinitions.typeDefaults.transformation,
    )
    const idField = transformationConfig.serviceIdField ?? 'id'
    const idValue = dataField
      ? (response?.[dataField] as Values)?.[idField]
      : response?.[idField]
    if (idValue !== undefined) {
      getChangeData(change).value[idField] = idValue
    }
  }
}

const getMatchedChild = ({
  change, response, childFieldName, dataField, childUniqueFieldName,
}: {
  change: Change<InstanceElement>
  response: clientUtils.ResponseValue
  childFieldName: string
  childUniqueFieldName: string
  dataField?: string
}): clientUtils.ResponseValue | undefined => {
  const childrenResponse = ((
    dataField !== undefined
      ? response[dataField]
      : response
    ) as Values)?.[childFieldName]
  if (childrenResponse) {
    if (_.isArray(childrenResponse)
    && childrenResponse.every(_.isPlainObject)) {
      return childrenResponse.find(
        child => child[childUniqueFieldName]
          && child[childUniqueFieldName] === getChangeData(change).value[childUniqueFieldName]
      )
    }
    log.warn(`Received invalid response for ${childFieldName} in ${getChangeData(change).elemID.getFullName()}`)
  }
  return undefined
}
export const addIdsToChildrenUponAddition = ({
  response, parentChange, childrenChanges, apiDefinitions, childFieldName, childUniqueFieldName,
}: {
  response: deployment.ResponseResult
  parentChange: Change<InstanceElement>
  childrenChanges: Change<InstanceElement>[]
  apiDefinitions: ZendeskApiConfig
  childFieldName: string
  childUniqueFieldName: string
}): Change<InstanceElement>[] => {
  const { deployRequests } = apiDefinitions
    .types[getChangeData(parentChange).elemID.typeName]
  childrenChanges
    .filter(isAdditionChange)
    .forEach(change => {
      if (response && !_.isArray(response)) {
        const dataField = deployRequests?.add?.deployAsField
        const child = getMatchedChild({
          change, response, dataField, childFieldName, childUniqueFieldName,
        })
        if (child) {
          addId({
            change, apiDefinitions, response: child,
          })
        }
      }
    })
  return [parentChange, ...childrenChanges]
}

export const deployChange = async (
  change: Change<InstanceElement>,
  client: ZendeskClient,
  apiDefinitions: configUtils.AdapterApiConfig,
  fieldsToIgnore?: string[],
  retryNumber = 0
): Promise<deployment.ResponseResult> => {
  const { deployRequests } = apiDefinitions.types[getChangeData(change).elemID.typeName]
  try {
    const response = await deployment.deployChange({
      change,
      client,
      endpointDetails: deployRequests,
      fieldsToIgnore,
    })
    addId({
      change,
      apiDefinitions,
      response,
      dataField: deployRequests?.add?.deployAsField,
    })
    return response
  } catch (err) {
    // Retry requests that failed on Zendesk's side and are not related to our data
    if (RESPONSES_TO_RETRY.includes(err.response?.status) && retryNumber < MAX_RETRIES) {
      const retryDelayMs = getRetryDelayFromHeaders(err.response.headers) ?? DEPLOYMENT_BUFFER_TIME
      log.warn(`Failed to deploy change of ${getChangeData(change).elemID.name} with error ${err.response?.status}. Retries left: ${MAX_RETRIES - retryNumber} (retrying in %ds)`, retryDelayMs / 1000)
      await sleep(retryDelayMs)
      return deployChange(change, client, apiDefinitions, fieldsToIgnore, retryNumber + 1)
    }
    throw getZendeskError(getChangeData(change).elemID, err)
  }
}

export const deployChanges = async <T extends Change<ChangeDataType>>(
  changes: T[],
  deployChangeFunc: (change: T) => Promise<void | T[]>
): Promise<DeployResult> => {
  const result = await Promise.all(
    changes.map(async change => {
      try {
        const res = await deployChangeFunc(change)
        return res !== undefined ? res : change
      } catch (err) {
        if (!_.isError(err)) {
          throw err
        }
        return err
      }
    })
  )

  const [errors, appliedChanges] = _.partition(result.flat(), _.isError)
  return { errors, appliedChanges }
}

export const deployChangesByGroups = async <T extends Change<ChangeDataType>>(
  changeGroups: T[][],
  deployChangeFunc: (change: T) => Promise<void | T[]>
): Promise<DeployResult> => {
  const deployGroupResults = await awu(changeGroups)
    .map(async changeGroup => deployChanges(changeGroup, deployChangeFunc))
    .toArray()
  return {
    errors: deployGroupResults.flatMap(res => res.errors),
    appliedChanges: deployGroupResults.flatMap(res => res.appliedChanges),
  }
}
