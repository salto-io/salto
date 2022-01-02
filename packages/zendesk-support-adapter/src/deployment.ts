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
import { Change, getChangeElement, InstanceElement, isAdditionChange, Values } from '@salto-io/adapter-api'
import { config as configUtils, deployment } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import ZendeskClient from './client/client'
import { getZendeskError } from './errors'

const log = logger(module)

export const deployChange = async (
  change: Change<InstanceElement>,
  client: ZendeskClient,
  apiDefinitions: configUtils.AdapterApiConfig,
): Promise<void> => {
  const { deployRequests, transformation } = apiDefinitions
    .types[getChangeElement(change).elemID.typeName]
  try {
    const response = await deployment.deployChange(
      change,
      client,
      deployRequests,
    )
    if (isAdditionChange(change)) {
      if (!Array.isArray(response)) {
        const transformationConfig = configUtils.getConfigWithDefault(
          transformation,
          apiDefinitions.typeDefaults.transformation,
        )
        const idField = transformationConfig.serviceIdField ?? 'id'
        const dataField = deployRequests?.add?.deployAsField
        const idValue = dataField
          ? (response?.[dataField] as Values)?.[idField]
          : response?.[idField]
        if (idValue !== undefined) {
          getChangeElement(change).value[idField] = idValue
        }
      } else {
        log.warn(
          'Received an array for the response of the deploy. Not updating the id of the element. Action: add. ID: %s',
          getChangeElement(change).elemID.getFullName()
        )
      }
    }
  } catch (err) {
    throw getZendeskError(getChangeElement(change).elemID.getFullName(), err)
  }
}
