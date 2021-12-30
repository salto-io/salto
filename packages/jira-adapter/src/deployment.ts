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
import { Change, getChangeElement, InstanceElement, isAdditionChange } from '@salto-io/adapter-api'
import { config, deployment, client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { resolveChangeElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import JiraClient from './client/client'
import { getLookUpName } from './references'

const log = logger(module)

export const deployChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
  apiDefinitions: config.AdapterApiConfig,
  fieldsToIgnore: string[] = [],
  additionalUrlVars?: Record<string, string>
): Promise<void> => {
  try {
    const changeToDeploy = await elementUtils.swagger.flattenAdditionalProperties(
      await resolveChangeElement(change, getLookUpName)
    )
    const response = await deployment.deployChange(
      changeToDeploy,
      client,
      apiDefinitions.types[getChangeElement(change).elemID.typeName]?.deployRequests,
      fieldsToIgnore,
      additionalUrlVars
    )

    if (isAdditionChange(change)) {
      if (!Array.isArray(response)) {
        const serviceIdField = apiDefinitions.types[getChangeElement(change).elemID.typeName]?.transformation?.serviceIdField ?? 'id'
        getChangeElement(change).value[serviceIdField] = response[serviceIdField]
      } else {
        log.warn('Received unexpected response from deployChange: %o', response)
      }
    }
  } catch (err) {
    const errorMessage = `Deployment of ${getChangeElement(change).elemID.getFullName()} failed: ${err}`
    if (err instanceof clientUtils.HTTPError && 'errorMessages' in err.response.data) {
      throw new Error(`${errorMessage}. ${err.response.data.errorMessages}`)
    }
    throw Error(errorMessage)
  }
}
