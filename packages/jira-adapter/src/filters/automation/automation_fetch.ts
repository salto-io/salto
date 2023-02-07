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
import { ElemIdGetter, InstanceElement, isInstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { createSchemeGuard, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import _ from 'lodash'
import { AUTOMATION_TYPE, JIRA, PROJECT_TYPE } from '../../constants'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { createAutomationTypes } from './types'
import { JiraConfig } from '../../config/config'
import { getCloudId } from './cloud_id'

const DEFAULT_PAGE_SIZE = 100

const log = logger(module)

type PageResponse = {
  total: number
  values: Values[]
}

const PAGE_RESPONSE_SCHEME = Joi.object({
  total: Joi.number().required(),
  values: Joi.array().items(Joi.object()).required(),
}).unknown(true).required()

const isPageResponse = createSchemeGuard<PageResponse>(PAGE_RESPONSE_SCHEME, 'Received an invalid page response')

const requestPage = async (
  url: string,
  client: JiraClient,
  offset: number,
  pageSize: number,
): Promise<PageResponse> => {
  const response = await client.post({
    url,
    data: {
      offset,
      limit: pageSize,
    },
  })

  if (!isPageResponse(response.data)) {
    throw new Error('Failed to get response page, received invalid response')
  }

  return response.data
}

const postPaginated = async (
  url: string,
  client: JiraClient,
  pageSize: number,
): Promise<Values[]> => {
  let hasMore = true
  const items: Values[] = []
  for (let offset = 0; hasMore; offset += pageSize) {
    // eslint-disable-next-line no-await-in-loop
    const response = await requestPage(url, client, offset, pageSize)

    hasMore = response.total > offset + pageSize
    items.push(...response.values)
  }

  return items
}

const createInstance = (
  values: Values,
  type: ObjectType,
  idToProject: Record<string, InstanceElement>,
  getElemIdFunc?: ElemIdGetter,
): InstanceElement => {
  const serviceIds = elementUtils.createServiceIds(values, 'id', type.elemID)

  const defaultName = naclCase([
    values.name,
    ...values.projects
      .map((project: Values) => idToProject[project.projectId]?.value.name)
      .filter(lowerdashValues.isDefined),
  ].join('_'))

  const instanceName = getElemIdFunc && serviceIds
    ? getElemIdFunc(JIRA, serviceIds, defaultName).name
    : defaultName


  return new InstanceElement(
    instanceName,
    type,
    values,
    [JIRA, elementUtils.RECORDS_PATH, AUTOMATION_TYPE, pathNaclCase(instanceName)],
  )
}

export const getAutomations = async (
  client: JiraClient,
  config: JiraConfig,
): Promise<Values[]> => (
  client.isDataCenter
    ? (await client.getSinglePage({
      url: '/rest/cb-automation/latest/project/GLOBAL/rule',
    })).data as Values[]
    : postPaginated(
      `/gateway/api/automation/internal-api/jira/${await getCloudId(client)}/pro/rest/GLOBAL/rules`,
      client,
        config.client.pageSize?.get ?? DEFAULT_PAGE_SIZE
    )
)

/**
 * Fetching automations from Jira using internal API endpoint.
 * We first use `/resources` endpoint to get the cloud id of the account.
 * Using the cloud id, we create the url to query the automations with
 */
const filter: FilterCreator = ({ client, getElemIdFunc, config, fetchQuery }) => ({
  name: 'automationFetchFilter',
  onFetch: async elements => {
    if (!fetchQuery.isTypeMatch(AUTOMATION_TYPE)) {
      return
    }

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping automation fetch filter because private API is not enabled')
      return
    }

    const idToProject = _(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .keyBy(instance => instance.value.id)
      .value()

    const automations = await getAutomations(client, config)

    const { automationType, subTypes } = createAutomationTypes()

    automations.forEach(automation => elements.push(
      createInstance(automation, automationType, idToProject, getElemIdFunc),
    ))
    elements.push(automationType, ...subTypes)
  },
})

export default filter
