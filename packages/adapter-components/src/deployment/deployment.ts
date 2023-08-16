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
import { ActionName, Change, ElemID, getChangeData, InstanceElement, ReadOnlyElementsSource, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { transformElement, inspectValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { createUrl } from '../elements/request_parameters'
import { HTTPWriteClientInterface } from '../client/http_client'
import { DeploymentRequestsByAction } from '../config/request'
import { ResponseValue } from '../client'
import { OPERATION_TO_ANNOTATION } from './annotations'

const log = logger(module)

export type ResponseResult = ResponseValue | ResponseValue[] | undefined

export const filterUndeployableValues = async (
  instance: InstanceElement,
  action: ActionName,
  elementsSource?: ReadOnlyElementsSource,
): Promise<InstanceElement> => (
  transformElement({
    element: instance,
    strict: false,
    allowEmpty: true,
    elementsSource,
    transformFunc: ({ value, field }) => {
      // The === false is because if the value is undefined, we don't want to filter it out
      if (field?.annotations[OPERATION_TO_ANNOTATION[action]] === false) {
        return undefined
      }
      return value
    },
  })
)

export const filterIgnoredValues = async (
  instance: InstanceElement,
  fieldsToIgnore: string[] | ((path: ElemID) => boolean),
  configFieldsToIgnore: string[] = [],
  elementsSource?: ReadOnlyElementsSource,
): Promise<InstanceElement> => {
  const filteredInstance = _.isFunction(fieldsToIgnore)
    ? (await transformElement({
      element: instance,
      strict: false,
      allowEmpty: true,
      elementsSource,
      transformFunc: ({ value, path }) => {
        if (path !== undefined && fieldsToIgnore(path)) {
          return undefined
        }
        return value
      },
    })) : instance


  filteredInstance.value = _.omit(
    filteredInstance.value,
    [...configFieldsToIgnore, ...Array.isArray(fieldsToIgnore) ? fieldsToIgnore : []],
  )

  return filteredInstance
}

/**
 * Deploy a single change to the service using the given details
 *
 * @param change The change to deploy. The change is expected to be fully resolved
 * (meaning without any ReferenceExpression or StaticFiles)
 * @param client The client to use to make the request
 * @param endpointDetails The details of of what endpoints to use for each action
 * @param fieldsToIgnore Fields to omit for the deployment
 * @param additionalUrlVars Additional url vars to add to the request url
 * @param queryParams Query params to add to the request url
 * @returns: The response data of the request
 */
export const deployChange = async ({
  change,
  client,
  endpointDetails,
  fieldsToIgnore = [],
  additionalUrlVars,
  queryParams,
  elementsSource,
}:{
  change: Change<InstanceElement>
  client: HTTPWriteClientInterface
  endpointDetails?: DeploymentRequestsByAction
  fieldsToIgnore?: string[] | ((path: ElemID) => boolean)
  additionalUrlVars?: Record<string, string>
  queryParams?: Record<string, string>
  elementsSource?: ReadOnlyElementsSource
}): Promise<ResponseResult> => {
  const instance = getChangeData(change)
  log.debug(`Starting deploying instance ${instance.elemID.getFullName()} with action '${change.action}'`)
  const endpoint = endpointDetails?.[change.action]
  if (endpoint === undefined) {
    throw new Error(`No endpoint of type ${change.action} for ${instance.elemID.typeName}`)
  }
  const valuesToDeploy = (await filterIgnoredValues(
    await filterUndeployableValues(getChangeData(change), change.action, elementsSource),
    fieldsToIgnore,
    endpoint.fieldsToIgnore,
    elementsSource,
  )).value

  const url = createUrl({
    instance,
    baseUrl: endpoint.url,
    urlParamsToFields: endpoint.urlParamsToFields,
    additionalUrlVars,
  })
  const data = endpoint.deployAsField
    ? { [endpoint.deployAsField]: valuesToDeploy }
    : valuesToDeploy

  if (_.isEmpty(valuesToDeploy) && isAdditionOrModificationChange(change)) {
    return undefined
  }
  log.trace(`deploying instance ${instance.elemID.getFullName()} with params ${inspectValue({ method: endpoint.method, url, data, queryParams }, { compact: true })}`)
  const response = await client[endpoint.method]({ url, data, queryParams })
  return response.data
}
