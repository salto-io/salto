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
import { ActionName, Change, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { transformElement } from '@salto-io/adapter-utils'
import { replaceUrlParams } from '../elements/request_parameters'
import { HTTPWriteClientInterface } from '../client/http_client'
import { DeploymentRequestsByAction } from '../config/request'
import { ResponseValue } from '../client'
import { OPERATION_TO_ANNOTATION } from './annotations'

const filterIrrelevantValues = async (
  instance: InstanceElement,
  action: ActionName
): Promise<InstanceElement> => (
  transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    transformFunc: ({ value, field }) => {
      // The === false is because if the value is undefined, we don't want to filter it out
      if (field?.annotations[OPERATION_TO_ANNOTATION[action]] === false) {
        return undefined
      }
      return value
    },
  })
)

/**
 * Deploy a single change to the service using the given details
 *
 * @param change The change to deploy. The change is expected to be fully resolved
 * (meaning without any ReferenceExpression or StaticFiles)
 * @param client The client to use to make the request
 * @param endpointDetails The details of of what endpoints to use for each action
 * @param fieldsToIgnore Fields to omit for the deployment
 * @param additionalUrlVars Additional url vars to add to the request url
 * @returns: The response data of the request
 */
export const deployChange = async (
  change: Change<InstanceElement>,
  client: HTTPWriteClientInterface,
  endpointDetails?: DeploymentRequestsByAction,
  fieldsToIgnore: string[] = [],
  additionalUrlVars?: Record<string, string>
): Promise<ResponseValue | ResponseValue[]> => {
  const instance = getChangeData(change)
  const endpoint = endpointDetails?.[change.action]
  if (endpoint === undefined) {
    throw new Error(`No endpoint of type ${change.action} for ${instance.elemID.typeName}`)
  }
  const valuesToDeploy = _.pickBy(
    (await filterIrrelevantValues(getChangeData(change), change.action)).value,
    (_value, key) => !fieldsToIgnore.includes(key)
  )

  const urlVarsValues = {
    ...instance.value,
    ..._.mapValues(endpoint.urlParamsToFields ?? {}, fieldName => instance.value[fieldName]),
    ...(additionalUrlVars ?? {}),
  }
  const url = replaceUrlParams(endpoint.url, urlVarsValues)
  const data = endpoint.deployAsField
    ? { [endpoint.deployAsField]: valuesToDeploy }
    : valuesToDeploy
  const response = await client[endpoint.method]({ url, data })

  return response.data
}
