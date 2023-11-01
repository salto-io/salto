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

import { ObjectType, Values, ElemIdGetter, InstanceElement } from '@salto-io/adapter-api'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import JiraClient from '../../../client/client'
import { FilterCreator } from '../../../filter'
import { getWorkspaceId } from '../workspace_id'
import { createAssestsSchemaTypes } from './assests_schema_types'
import { JIRA } from '../../../constants'

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

const createInstance = (
  type: ObjectType,
  values: Values,
  getElemIdFunc?: ElemIdGetter
):
InstanceElement => {
  const serviceIds = elementUtils.createServiceIds(values, 'id', type.elemID)
  const defaultName = naclCase(values.name)
  const instanceName = getElemIdFunc && serviceIds
    ? getElemIdFunc(JIRA, serviceIds, defaultName).name
    : defaultName
  return new InstanceElement(
    instanceName,
    type,
    values,
    [JIRA, elementUtils.RECORDS_PATH, 'AssestsSchema', pathNaclCase(instanceName), pathNaclCase(instanceName)],
  )
}

/**
 * Fetching assests from Jira using internal API endpoint.
 */
const filter: FilterCreator = ({ client, config, getElemIdFunc }) => ({
  name: 'AssestsSchemaFetchFilter',
  onFetch: async elements => {
    if (!config.fetch.enableJSM || !config.fetch.enableJsmExperimental) {
      return undefined
    }
    try {
      const workSpcaeId = await getWorkspaceId(client)
      const assestsSchemas = await getAssestsSchema(client, workSpcaeId)
      const { assestSchemaType } = createAssestsSchemaTypes()
      elements.push(assestSchemaType)
      assestsSchemas.forEach(assestSchema => elements.push(
        createInstance(assestSchemaType, assestSchema, getElemIdFunc)
      ))
      return undefined
    } catch (err) {
      log.error(`Received a ${err.response.status} error when fetching assests schemas.`)
      return {
        errors: [
          {
            message: `Received a ${err.response.status} error when fetching assests schemas.`,
            severity: 'Warning',
          },
        ],
      }
    }
  },
})

export default filter
