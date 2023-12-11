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

import { logger } from '@salto-io/logging'
import { ElemIdGetter, InstanceElement, ObjectType, Element, isInstanceElement, CORE_ANNOTATIONS, Change, DeployResult, getChangeData, isInstanceChange, isAdditionChange } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { createSchemeGuard, getParent, isResolvedReferenceExpression, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as adapterElements, config as configUtils } from '@salto-io/adapter-components'
import { FilterResult } from '@salto-io/adapter-utils/src/filter'
import _ from 'lodash'
import { deployChanges } from '../../deployment/standard_deployment'
import { setTypeDeploymentAnnotations, addAnnotationRecursively } from '../../utils'
import { JiraConfig } from '../../config/config'
import JiraClient, { graphQLResponseType } from '../../client/client'
import { QUERY, QUERY_JSM } from './layout_queries'
import { ISSUE_LAYOUT_CONFIG_ITEM_SCHEME, ISSUE_LAYOUT_RESPONSE_SCHEME, issueLayoutConfig, layoutConfigItem, IssueLayoutResponse, createLayoutType, IssueLayoutConfiguration } from './layout_types'
import { ISSUE_LAYOUT_TYPE, ISSUE_VIEW_TYPE, JIRA, REQUEST_FORM_TYPE, REQUEST_TYPE_NAME } from '../../constants'
import { DEFAULT_API_DEFINITIONS } from '../../config/api_config'

const log = logger(module)
const { isDefined } = lowerDashValues
const { toBasicInstance } = adapterElements
const { getTransformationConfigByType } = configUtils

type LayoutTypeDetails = {
    pathParam: string
    query: string
    layoutType?: string
    fieldName: string
}

type QueryVariables = {
    projectId: string | number
    extraDefinerId: string | number
    layoutType?: string
  }

export type LayoutTypeName = 'RequestForm' | 'IssueView' | 'IssueLayout'
export const LAYOUT_TYPE_NAME_TO_DETAILS: Record<LayoutTypeName, LayoutTypeDetails> = {
  [REQUEST_FORM_TYPE]: {
    layoutType: 'REQUEST_FORM',
    pathParam: 'RequestForm',
    query: QUERY_JSM,
    fieldName: 'requestForm',
  },
  [ISSUE_LAYOUT_TYPE]: {
    pathParam: 'layouts',
    query: QUERY,
    fieldName: 'issueLayout',
  },
  [ISSUE_VIEW_TYPE]: {
    layoutType: 'ISSUE_VIEW',
    pathParam: 'IssueView',
    query: QUERY_JSM,
    fieldName: 'issueView',
  },
}

export const isIssueLayoutResponse = createSchemeGuard<IssueLayoutResponse>(ISSUE_LAYOUT_RESPONSE_SCHEME)
const isLayoutConfigItem = createSchemeGuard<layoutConfigItem>(ISSUE_LAYOUT_CONFIG_ITEM_SCHEME)

function isLayoutTypeName(typeName: string): typeName is LayoutTypeName {
  return Object.keys(LAYOUT_TYPE_NAME_TO_DETAILS).includes(typeName)
}

export const getLayoutResponse = async ({
  variables,
  client,
  typeName,
}:{
    variables: QueryVariables
    client: JiraClient
    typeName: LayoutTypeName
    }): Promise<graphQLResponseType> => {
  const baseUrl = '/rest/gira/1'
  try {
    const query = LAYOUT_TYPE_NAME_TO_DETAILS[typeName]?.query
    if (query === undefined) {
      log.error(`Failed to get issue layout for project ${variables.projectId} and screen ${variables.extraDefinerId}: query is undefined`)
    }
    const response = await client.gqlPost({
      url: baseUrl,
      query,
      variables,
    })
    return response
  } catch (e) {
    log.error(`Failed to get issue layout for project ${variables.projectId} and screen ${variables.extraDefinerId}: ${e}`)
  }
  return { data: undefined }
}

const fromLayoutConfigRespToLayoutConfig = (
  layoutConfig: IssueLayoutConfiguration
): issueLayoutConfig => {
  const { containers } = layoutConfig.issueLayoutResult
  const fieldItemIdToMetaData = Object.fromEntries(layoutConfig.metadata.configuration.items.nodes
    .filter(node => !_.isEmpty(node))
    .map(node => [node.fieldItemId, _.omit(node, 'fieldItemId')]))

  const items = containers
    .flatMap(container => container.items.nodes
      .map(node => ({
        type: 'FIELD',
        sectionType: container.containerType,
        key: node.fieldItemId,
        data: fieldItemIdToMetaData[node.fieldItemId],
      })))
    .filter(isLayoutConfigItem)

  return { items }
}

export const getLayout = async ({
  variables,
  response,
  instance,
  layoutType,
  getElemIdFunc,
  typeName,
}: {
        variables: QueryVariables
        response: graphQLResponseType
        instance: InstanceElement
        layoutType: ObjectType
        getElemIdFunc?: ElemIdGetter | undefined
        typeName: LayoutTypeName
    }): Promise<InstanceElement | undefined> => {
  if (!Array.isArray(response.data) && isIssueLayoutResponse(response.data) && instance.path !== undefined) {
    const { issueLayoutResult } = response.data.issueLayoutConfiguration
    const value = {
      id: issueLayoutResult.id,
      projectId: variables.projectId,
      extraDefinerId: variables.extraDefinerId,
      issueLayoutConfig: fromLayoutConfigRespToLayoutConfig(response.data.issueLayoutConfiguration),
    }
    const name = `${instance.value.name}_${issueLayoutResult.name}`
    const serviceIds = adapterElements.createServiceIds(value, 'id', layoutType.elemID)
    const instanceName = getElemIdFunc ? getElemIdFunc(JIRA, serviceIds, naclCase(name)).name
      : naclCase(name)
    return toBasicInstance({
      entry: value,
      type: layoutType,
      transformationConfigByType: getTransformationConfigByType(DEFAULT_API_DEFINITIONS.types),
      transformationDefaultConfig: DEFAULT_API_DEFINITIONS.typeDefaults.transformation,
      parent: instance,
      defaultName: name,
      getElemIdFunc,
      nestedPath:
      [...instance.path?.slice(2, instance.path?.length - 1),
        LAYOUT_TYPE_NAME_TO_DETAILS[typeName].pathParam,
        pathNaclCase(instanceName)],
    })
  }
  return undefined
}

const deployLayoutChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const layout = getChangeData(change)
  const { typeName } = layout.elemID
  if (!isLayoutTypeName(typeName)) {
    return undefined
  }
  const items = layout.value.issueLayoutConfig.items.map((item: layoutConfigItem) => {
    if (isResolvedReferenceExpression(item.key)) {
      const key = item.key.value.value.id
      return {
        type: item.type,
        sectionType: item.sectionType.toLocaleLowerCase(),
        key,
        data: {
          name: item.key.value.value.name,
          type: item.key.value.value.type
          ?? item.key.value.value.schema?.system
          ?? item.key.value.value.name.toLowerCase(),
          ...item.data,
        },
      }
    }
    return undefined
  }).filter(isDefined)

  if (isResolvedReferenceExpression(layout.value.projectId)
    && isResolvedReferenceExpression(layout.value.extraDefinerId)) {
    const data = {
      projectId: layout.value.projectId.value.value.id,
      extraDefinerId: layout.value.extraDefinerId.value.value.id,
      issueLayoutType: 'ISSUE_VIEW',
      owners: [],
      issueLayoutConfig: {
        items,
      },
    }
    if (isAdditionChange(change)) {
      const variables = {
        projectId: layout.value.projectId.value.value.id,
        extraDefinerId: layout.value.extraDefinerId.value.value.id,
      }
      const response = await getLayoutResponse({ variables, client, typeName })
      if (!isIssueLayoutResponse(response.data)) {
        throw Error('Failed to deploy issue layout changes due to bad response from jira service')
      }
      layout.value.id = response.data.issueLayoutConfiguration.issueLayoutResult.id
    }
    const url = `/rest/internal/1.0/issueLayouts/${layout.value.id}`
    await client.put({ url, data })
    return undefined
  }
  throw Error('Failed to deploy issue layout changes due to missing references')
}

export const deployLayoutChanges = async ({
  changes,
  client,
  typeName,
}: {
    changes: Change[]
    client: JiraClient
    typeName: LayoutTypeName
}): Promise<{
    deployResult: DeployResult
    leftoverChanges: Change[]
}> => {
  const [issueLayoutsChanges, leftoverChanges] = _.partition(
    changes,
    change => isInstanceChange(change) && getChangeData(change).elemID.typeName === typeName
  )
  const deployResult = await deployChanges(issueLayoutsChanges.filter(isInstanceChange),
    async change => deployLayoutChange(change, client))

  return {
    leftoverChanges,
    deployResult,
  }
}

export const fetchRequestTypeDetails = async ({
  elements,
  client,
  config,
  fetchQuery,
  getElemIdFunc,
  typeName,
}: {
    elements: Element[]
    client: JiraClient
    config: JiraConfig
    fetchQuery: adapterElements.query.ElementQuery
    getElemIdFunc?: ElemIdGetter | undefined
    typeName: LayoutTypeName
}): Promise<void | FilterResult> => {
  if (client.isDataCenter
    || !config.fetch.enableJSM
    || !fetchQuery.isTypeMatch(typeName)) {
    return
  }
  const requestTypeIdToRequestType: Record<string, InstanceElement> = Object.fromEntries(
    (await Promise.all(elements.filter(e => e.elemID.typeName === REQUEST_TYPE_NAME)
      .filter(isInstanceElement)
      .map(async requestType => {
        if (requestType.value.id === undefined) {
          return undefined
        }
        return [requestType.value.id, requestType]
      })))
      .filter(isDefined)
  )

  const { layoutType: issueLayoutType } = createLayoutType(typeName)
  elements.push(issueLayoutType)

  const layouts = (await Promise.all(Object.entries(requestTypeIdToRequestType)
    .flatMap(async ([requestTypeId, requestTypeInstance]) => {
      const projectInstance = getParent(requestTypeInstance)
      const variables = {
        projectId: projectInstance.value.id,
        extraDefinerId: requestTypeId,
        layoutType: LAYOUT_TYPE_NAME_TO_DETAILS[typeName].layoutType,
      }
      const response = await getLayoutResponse({
        variables,
        client,
        typeName,
      })
      return getLayout({
        variables,
        response,
        instance: requestTypeInstance,
        layoutType: issueLayoutType,
        getElemIdFunc,
        typeName,
      })
    }))).filter(isDefined)
  layouts.forEach(layout => { elements.push(layout) })
  setTypeDeploymentAnnotations(issueLayoutType)
  await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.CREATABLE)
  await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.UPDATABLE)
  await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.DELETABLE)
}
