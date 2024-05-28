/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  ElemIdGetter,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { createSchemeGuard, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as elementUtils, client as clientUtils, config as configUtils } from '@salto-io/adapter-components'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import _ from 'lodash'
import {
  AUTOMATION_RETRY_PERIODS,
  AUTOMATION_TYPE,
  fetchFailedWarnings,
  JIRA,
  PROJECT_TYPE,
  PROJECTS_FIELD,
} from '../../constants'
import JiraClient from '../../client/client'
import { FilterCreator } from '../../filter'
import { createAutomationTypes } from './types'
import { JiraConfig } from '../../config/config'
import { getCloudId } from './cloud_id'
import { convertRuleScopeValueToProjects } from './automation_structure'

export type AssetComponent = {
  value: {
    workspaceId?: string
    schemaId: ReferenceExpression
    objectTypeId?: ReferenceExpression
    schemaLabel?: string
    objectTypeLabel?: string
  }
}
type Component = {
  children: Component[]
  conditions: Component[]
}

const ASSET_COMPONENT_SCHEME = Joi.object({
  value: Joi.object({
    objectTypeId: Joi.string(),
    workspaceId: Joi.string(),
    schemaId: Joi.string().required(),
    schemaLabel: Joi.string(),
    objectTypeLabel: Joi.string(),
  })
    .unknown(true)
    .required(),
}).unknown(true)

export const isAssetComponent = createSchemeGuard<AssetComponent>(ASSET_COMPONENT_SCHEME)
const DEFAULT_PAGE_SIZE = 1000
const { getInstanceName } = elementUtils
const log = logger(module)

type PageResponse = {
  total: number
  values: Values[]
}

const PAGE_RESPONSE_SCHEME = Joi.object({
  total: Joi.number().required(),
  values: Joi.array().items(Joi.object()).required(),
})
  .unknown(true)
  .required()

const isPageResponse = createSchemeGuard<PageResponse>(PAGE_RESPONSE_SCHEME, 'Received an invalid page response')

const requestPageRecurse = async ({
  url,
  client,
  offset,
  pageSize,
  retriesUsed,
}: {
  url: string
  client: JiraClient
  offset: number
  pageSize: number
  retriesUsed: number
}): Promise<PageResponse> => {
  if (retriesUsed > AUTOMATION_RETRY_PERIODS.length) {
    throw new Error('Failed to get automation requests following multiple retries with 504 errors')
  }
  if (retriesUsed > 0) {
    log.warn('Received a 504 error for automation private API, retrying')
    await new Promise(resolve => setTimeout(resolve, AUTOMATION_RETRY_PERIODS[retriesUsed - 1]))
  }
  try {
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
  } catch (e) {
    // we get an occasional 504 from the Automation's APIs, Atlassian's solution is to retry
    if (!(e instanceof clientUtils.HTTPError && e.response?.status === 504)) {
      throw e
    }
  }
  return requestPageRecurse({ url, client, offset, pageSize, retriesUsed: retriesUsed + 1 })
}

const postPaginated = async (url: string, client: JiraClient, pageSize: number): Promise<Values[]> => {
  let hasMore = true
  const items: Values[] = []
  for (let offset = 0; hasMore; offset += pageSize) {
    // eslint-disable-next-line no-await-in-loop
    const response = await requestPageRecurse({ url, client, offset, pageSize, retriesUsed: 0 })

    hasMore = response.total > offset + pageSize
    items.push(...response.values)
  }

  return items
}

const createInstance = (
  values: Values,
  type: ObjectType,
  idToProject: Record<string, InstanceElement>,
  config: JiraConfig,
  getElemIdFunc?: ElemIdGetter,
): InstanceElement => {
  const serviceIds = elementUtils.createServiceIds({ entry: values, serviceIDFields: ['id'], typeID: type.elemID })
  const idFields = configUtils.getTypeTransformationConfig(
    AUTOMATION_TYPE,
    config.apiDefinitions.types,
    config.apiDefinitions.typeDefaults,
  ).idFields ?? ['name']
  const idFieldsWithoutProjects = idFields.filter(field => field !== PROJECTS_FIELD)
  const defaultName = naclCase(
    [
      getInstanceName(values, idFieldsWithoutProjects, AUTOMATION_TYPE) ?? '',
      ...(idFields.includes(PROJECTS_FIELD)
        ? (convertRuleScopeValueToProjects(values) ?? [])
            .map((project: Values) => idToProject[project.projectId]?.value.name)
            .filter(lowerdashValues.isDefined)
            .sort()
        : []),
    ].join('_'),
  )

  const instanceName = getElemIdFunc && serviceIds ? getElemIdFunc(JIRA, serviceIds, defaultName).name : defaultName

  return new InstanceElement(instanceName, type, values, [
    JIRA,
    elementUtils.RECORDS_PATH,
    AUTOMATION_TYPE,
    pathNaclCase(instanceName),
  ])
}

// For components that has assets fields, we need to remove some fields that can be calculated from the schema and object type
const processComponents = (component: Component): void => {
  if (isAssetComponent(component)) {
    delete component.value.schemaLabel
    delete component.value.objectTypeLabel
    delete component.value.workspaceId
  }
  if (component.children) {
    component.children.forEach(processComponents)
  }
  if (component.conditions) {
    component.conditions.forEach(processComponents)
  }
}

/* Since the children and conditions of the components can also be of the AssetComponent type,
 * we need to handle them the same way as we handle the top-level component value. */
const modifyAssetsComponents = (instance: InstanceElement): void => {
  if (instance.value.components !== undefined) {
    instance.value.components.forEach(processComponents)
  }
  if (instance.value.trigger !== undefined) {
    processComponents(instance.value.trigger)
  }
}

export const getAutomations = async (client: JiraClient, config: JiraConfig): Promise<Values[]> =>
  client.isDataCenter
    ? ((
        await client.get({
          url: '/rest/cb-automation/latest/project/GLOBAL/rule',
        })
      ).data as Values[])
    : postPaginated(
        `/gateway/api/automation/internal-api/jira/${await getCloudId(client)}/pro/rest/GLOBAL/rules`,
        client,
        config.client.pageSize?.get ?? DEFAULT_PAGE_SIZE,
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
      return undefined
    }

    if (!config.client.usePrivateAPI) {
      log.debug('Skipping automation fetch filter because private API is not enabled')
      return undefined
    }

    const idToProject = _(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
      .keyBy(instance => instance.value.id)
      .value()

    try {
      const automations = await getAutomations(client, config)
      const { automationType, subTypes } = createAutomationTypes()

      automations.forEach(automation =>
        elements.push(createInstance(automation, automationType, idToProject, config, getElemIdFunc)),
      )
      if (config.fetch.enableJSM && (config.fetch.enableJsmExperimental || config.fetch.enableJSMPremium)) {
        elements
          .filter(isInstanceElement)
          .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
          .forEach(instance => modifyAssetsComponents(instance))
      }
      elements.push(automationType, ...subTypes)
      return undefined
    } catch (e) {
      if (
        e instanceof clientUtils.HTTPError &&
        e.response !== undefined &&
        (e.response.status === 403 || e.response.status === 405)
      ) {
        log.error(
          `Received a ${e.response.status} error when fetching automations. Please make sure you have the "Automation" permission enabled in Jira.`,
        )
        return {
          errors: [
            {
              message: fetchFailedWarnings(AUTOMATION_TYPE),
              severity: 'Warning',
            },
          ],
        }
      }
      throw e
    }
  },
})

export default filter
