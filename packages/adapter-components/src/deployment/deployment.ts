/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Change, getChangeElement, isInstanceChange, Element } from '@salto-io/adapter-api'
import { resolveReferences } from '@salto-io/adapter-utils'
import { getUrlVars, setUrlVarsValues } from '../elements/request_parameters'
import { HTTPWriteClientInterface } from '../client/http_client'
import { getDiffInstance } from './diff'
import { DeploymentRequests } from '../config/request'
import { ResponseValue } from '../client'

/**
 * Deploy a single change to the service using the given details
 *
 * @param change The change to deploy
 * @param client The client to use to make the request
 * @param endpointDetails The details of of what endpoints to use for each action
 * @param fieldsToIgnore Fields to omit for the deployment
 * @param additionalUrlVars Additional url vars to add to the request url
 * @returns: The response data of the request
 */
export const deployChange = async (
  change: Change<Element>,
  client: HTTPWriteClientInterface,
  endpointDetails?: DeploymentRequests,
  fieldsToIgnore: string[] = [],
  additionalUrlVars?: Record<string, string>
): Promise<ResponseValue | ResponseValue[]> => {
  if (!isInstanceChange(change)) {
    throw new Error(`Received a change of ${getChangeElement(change).elemID.idType} while the adapter ${getChangeElement(change).elemID.adapter} only support instance changes`)
  }

  const instance = getChangeElement(change)
  const type = await instance.getType()
  const endpoint = endpointDetails?.[change.action]
  if (endpoint === undefined) {
    throw new Error(`No endpoint of type ${change.action} for ${instance.elemID.typeName}`)
  }
  const resolvedValues = await resolveReferences(
    _.pickBy(
      getDiffInstance(change).value,
      (_value, key) => !fieldsToIgnore.includes(key)
    ),
    type
  )

  const urlVarsValues = Object.fromEntries(
    getUrlVars(endpoint.url)
      .map(varKey => [
        varKey,
        {
          ...instance.value,
          ...(additionalUrlVars ?? {}),
        }[endpoint.urlVarsToFields?.[varKey] ?? varKey],
      ])
  )
  const url = setUrlVarsValues(endpoint.url, urlVarsValues)
  const response = await client[endpoint.method]({ url, data: resolvedValues })

  return response.data
}
