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

import { Values } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { getWorkspaceId } from './workspace_id'

const log = logger(module)

const getAssestsSchema = async (
  client: JiraClient,
  workspaceId: string,
): Promise<Values[]> => {
  const response = (await (client.getSinglePage({
    url: `/gateway/api/jsm/assets/workspace/${workspaceId}/v1/objectschema/list?maxResults=1000`,
  }))).data.values as Values[]
  return response
}

/**
 * Fetching assests from Jira using internal API endpoint.
 */
const filter: FilterCreator = ({ client, config }) => ({
  name: 'AssestsSchemaFetchFilter',
  onFetch: async () => {
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental) {
      return undefined
    }
    try {
      const workSpcaeId = await getWorkspaceId(client)
      const assestsSchema = await getAssestsSchema(client, workSpcaeId)
      return undefined
    } catch (err) {
      log.error(`Received a ${err.response.status} error when fetching automations. Please make sure you have the "Automation" permission enabled in Jira.`)
      return {
        errors: [
          {
            message: 'defualt error',
            severity: 'Warning',
          },
        ],
      }
    }
  },
})

export default filter
