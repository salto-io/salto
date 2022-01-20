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
import { Change, ChangeDataType, DeployResult, getChangeData, InstanceElement, isAdditionChange, Values } from '@salto-io/adapter-api'
import { config as configUtils, deployment } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import ZendeskClient from './client/client'
import { getZendeskError } from './errors'

const log = logger(module)

export const addIdUponAddition = (
  change: Change<InstanceElement>,
  apiDefinitions: configUtils.AdapterApiConfig,
  response: deployment.ResponseResult,
  dataField?: string,
): void => {
  const { transformation } = apiDefinitions
    .types[getChangeData(change).elemID.typeName]
  if (isAdditionChange(change)) {
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

export const deployChange = async (
  change: Change<InstanceElement>,
  client: ZendeskClient,
  apiDefinitions: configUtils.AdapterApiConfig,
  fieldsToIgnore?: string[],
): Promise<deployment.ResponseResult> => {
  const { deployRequests } = apiDefinitions.types[getChangeData(change).elemID.typeName]
  try {
    const response = await deployment.deployChange(
      change,
      client,
      deployRequests,
      fieldsToIgnore
    )
    addIdUponAddition(change, apiDefinitions, response, deployRequests?.add?.deployAsField)
    return response
  } catch (err) {
    throw getZendeskError(getChangeData(change).elemID.getFullName(), err)
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
