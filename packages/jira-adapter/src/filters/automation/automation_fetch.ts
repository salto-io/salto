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
import { ElemIdGetter, InstanceElement, isInstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { naclCase, pathNaclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import _ from 'lodash'
import { AUTOMATION_TYPE, JIRA, PROJECT_TYPE } from '../../constants'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { createAutomationTypes } from './types'

const PAGE_SIZE = 100

const log = logger(module)

type AutomationsResponse = {
  total: number
  values: Values[]
}

const AUTOMATION_RESPONSE_SCHEME = Joi.object({
  total: Joi.number().required(),
  values: Joi.array().items(Joi.object()).required(),
}).unknown(true).required()


type Resources = {
  unparsedData: {
    'com.atlassian.jira.jira-client-analytics-plugin:analytics-context-provider.client-analytic-descriptors': string
  }
}

const RESOURCES_SCHEME = Joi.object({
  unparsedData: Joi.object({
    'com.atlassian.jira.jira-client-analytics-plugin:analytics-context-provider.client-analytic-descriptors': Joi.string().required(),
  }).unknown(true).required(),
}).unknown(true).required()

const isResources = (value: unknown): value is Resources => {
  const { error } = RESOURCES_SCHEME.validate(value)
  if (error !== undefined) {
    log.error(`Received invalid resources result: ${error.message}, ${safeJsonStringify(value)}`)
    return false
  }
  return true
}

const getCloudId = async (client: JiraClient): Promise<string> => {
  const response = await client.post({
    url: '/rest/webResources/1.0/resources',
    data: {
      r: [],
      c: ['jira.webresources:jira-global'],
      xc: [],
      xr: [],
    },
  })

  if (!isResources(response.data)) {
    throw new Error('Failed to get cloud id, received invalid response')
  }

  const id = JSON.parse(response.data.unparsedData['com.atlassian.jira.jira-client-analytics-plugin:analytics-context-provider.client-analytic-descriptors']).tenantId
  if (id === undefined) {
    throw new Error('Failed to get cloud id, tenantId not found')
  }
  return id
}

const isAutomationResponse = (value: unknown): value is AutomationsResponse => {
  const { error } = AUTOMATION_RESPONSE_SCHEME.validate(value)
  if (error !== undefined) {
    log.error(`Received invalid automation response: ${error.message}, ${safeJsonStringify(value)}`)
    return false
  }
  return true
}

const requestAutomations = async (
  cloudId: string,
  client: JiraClient,
  offset: number,
): Promise<AutomationsResponse> => {
  const response = await client.post({
    url: `/gateway/api/automation/internal-api/jira/${cloudId}/pro/rest/GLOBAL/rules`,
    data: {
      offset,
      limit: PAGE_SIZE,
    },
  })

  if (!isAutomationResponse(response.data)) {
    throw new Error('Failed to get automations, received invalid response')
  }

  return response.data
}

const getAutomations = async (
  cloudId: string,
  client: JiraClient,
): Promise<Values[]> => {
  let hasMore = true
  const automations: Values[] = []
  for (let offset = 0; hasMore; offset += PAGE_SIZE) {
    // eslint-disable-next-line no-await-in-loop
    const response = await requestAutomations(cloudId, client, offset)

    hasMore = response.total > offset + PAGE_SIZE
    automations.push(...response.values)
  }

  return automations
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


const filter: FilterCreator = ({ client, getElemIdFunc, config }) => ({
  onFetch: async elements => {
    if (!config.client.usePrivateAPI) {
      log.debug('Skipping automation fetch filter because private API is not enabled')
      return
    }

    const id = await getCloudId(client)

    const idToProject = _(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .keyBy(instance => instance.value.id)
      .value()

    const automations = await getAutomations(id, client)

    const { automationType, subTypes } = createAutomationTypes()

    automations.forEach(automation => elements.push(
      createInstance(automation, automationType, idToProject, getElemIdFunc),
    ))
    elements.push(automationType, ...subTypes)
  },
})

export default filter
