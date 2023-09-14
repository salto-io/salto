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
import { createSchemeGuard, isResolvedReferenceExpression, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as adapterElements } from '@salto-io/adapter-components'
import { FilterResult } from '@salto-io/adapter-utils/src/filter'
import _ from 'lodash'
import { deployChanges } from '../../deployment/standard_deployment'
import { setTypeDeploymentAnnotations, addAnnotationRecursively } from '../../utils'
import { JiraConfig } from '../../config/config'
import JiraClient, { graphQLResponseType } from '../../client/client'
import { QUERY } from './layout_queries'
import { ISSUE_LAYOUT_CONFIG_ITEM_SCHEME, ISSUE_LAYOUT_RESPONSE_SCHEME, IssueLayoutConfig, IssueLayoutConfigItem, IssueLayoutResponse, containerIssueLayoutResponse, createLayoutType } from './layout_types'
import { ISSUE_LAYOUT_TYPE, ISSUE_VIEW_TYPE, JIRA, REQUEST_FORM_TYPE, REQUEST_TYPE_NAME } from '../../constants'

const log = logger(module)
const { isDefined } = lowerDashValues

type layoutTypeDetails = {
    pathParam: string
    layoutTypeParam?: string
}

type QueryVariables = {
    projectId: string | number
    extraDefinerId: string | number
    layoutTypeParam?: string
  }

const layoutTypeNameToDetails: Record<string, layoutTypeDetails> = {
  [REQUEST_FORM_TYPE]: {
    layoutTypeParam: 'REQUEST_FORM',
    pathParam: 'RequestForm',
  },
  [ISSUE_LAYOUT_TYPE]: {
    pathParam: 'layouts',
  },
  [ISSUE_VIEW_TYPE]: {
    layoutTypeParam: 'ISSUE_VIEW',
    pathParam: 'IssueView',
  },
}

const isIssueLayoutResponse = createSchemeGuard<IssueLayoutResponse>(ISSUE_LAYOUT_RESPONSE_SCHEME)
const isIssueLayoutConfigItem = createSchemeGuard<IssueLayoutConfigItem>(ISSUE_LAYOUT_CONFIG_ITEM_SCHEME)

export const getLayoutResponse = async ({
  variables,
  client,
}:{
    variables: QueryVariables
    client: JiraClient
    }): Promise<graphQLResponseType> => {
  const baseUrl = '/rest/gira/1'
  try {
    const response = await client.gqlPost({
      url: baseUrl,
      query: QUERY,
      variables,
    })
    return response
  } catch (e) {
    log.error(`Failed to get issue layout for project ${variables.projectId} and screen ${variables.extraDefinerId}: ${e}`)
  }
  return { data: undefined }
}

const fromIssueLayoutConfigRespToIssueLayoutConfig = (
  containers: containerIssueLayoutResponse[]
):
  IssueLayoutConfig => {
  const items = containers.flatMap(container => container.items.nodes.map(node => ({
    type: 'FIELD',
    sectionType: container.containerType,
    key: node.fieldItemId,
  }))).filter(isIssueLayoutConfigItem)

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
        typeName: string
    }): Promise<InstanceElement | undefined> => {
  if (!Array.isArray(response.data) && isIssueLayoutResponse(response.data) && instance.path !== undefined) {
    const { issueLayoutResult } = response.data.issueLayoutConfiguration
    const { containers } = issueLayoutResult
    const value = {
      id: issueLayoutResult.id,
      projectId: variables.projectId,
      extraDefinerId: variables.extraDefinerId,
      issueLayoutConfig: fromIssueLayoutConfigRespToIssueLayoutConfig(containers),
    }
    const name = `${instance.value.name}_${issueLayoutResult.name}`
    const serviceIds = adapterElements.createServiceIds(value, 'id', layoutType.elemID)
    const instanceName = getElemIdFunc ? getElemIdFunc(JIRA, serviceIds, naclCase(name)).name
      : naclCase(name)
    return new InstanceElement(
      instanceName,
      layoutType,
      value,
      [...instance.path.slice(0, -1), layoutTypeNameToDetails[typeName].pathParam, pathNaclCase(instanceName)],
    )
  }
  return undefined
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
    typeName: string
}): Promise<void | FilterResult> => {
  if (client.isDataCenter
  || !fetchQuery.isTypeMatch(typeName)
  || !config.fetch.enableJSM) {
    return
  }
  const requestTypeIdToRequestType: Record<string, InstanceElement> = Object.fromEntries(
    (await Promise.all(elements.filter(e => e.elemID.typeName === REQUEST_TYPE_NAME)
      .filter(isInstanceElement)
      .map(async requestType => [requestType.value.id, requestType])))
      .filter(isDefined)
  )

  const { issueLayoutType } = createLayoutType(typeName)
  elements.push(issueLayoutType)

  const layouts = (await Promise.all(Object.entries(requestTypeIdToRequestType)
    .flatMap(async ([requestTypeId, requestTypeInstance]) => {
      const projectInstance = requestTypeInstance.value.projectKey.value
      const variables = {
        projectId: projectInstance.value.id,
        extraDefinerId: requestTypeId,
        layoutTypeParam: layoutTypeNameToDetails[typeName].layoutTypeParam,
      }
      const response = await getLayoutResponse({
        variables,
        client,
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

const deployIssueLayoutChanges = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const issueLayout = getChangeData(change)
  const items = issueLayout.value.issueLayoutConfig.items.map((item: IssueLayoutConfigItem) => {
    if (isResolvedReferenceExpression(item.key)) {
      const key = item.key.value.value.id
      return {
        type: item.type,
        sectionType: item.sectionType.toLocaleLowerCase(),
        key,
        data: {
          name: item.key.value.value.name,
          type: item.key.value.value.type ?? item.key.value.value.schema.system,
        },
      }
    }
    return undefined
  }).filter(isDefined)

  if (isResolvedReferenceExpression(issueLayout.value.projectId)
    && isResolvedReferenceExpression(issueLayout.value.extraDefinerId)) {
    const data = {
      projectId: issueLayout.value.projectId.value.value.id,
      extraDefinerId: issueLayout.value.extraDefinerId.value.value.id,
      issueLayoutType: 'ISSUE_VIEW',
      owners: [],
      issueLayoutConfig: {
        items,
      },
    }
    if (isAdditionChange(change)) {
      const variables = {
        projectId: issueLayout.value.projectId.value.value.id,
        extraDefinerId: issueLayout.value.extraDefinerId.value.value.id,
      }
      const response = await getLayoutResponse({ variables, client })
      if (!isIssueLayoutResponse(response.data)) {
        throw Error('Failed to deploy issue layout changes due to bad response from jira service')
      }
      issueLayout.value.id = response.data.issueLayoutConfiguration.issueLayoutResult.id
    }
    const url = `/rest/internal/1.0/issueLayouts/${issueLayout.value.id}`
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
    typeName: string
}): Promise<{
    deployResult: DeployResult
    leftoverChanges: Change[]
}> => {
  const [issueLayoutsChanges, leftoverChanges] = _.partition(
    changes,
    change => isInstanceChange(change) && getChangeData(change).elemID.typeName === typeName
  )
  const deployResult = await deployChanges(issueLayoutsChanges.filter(isInstanceChange),
    async change => deployIssueLayoutChanges(change, client))

  return {
    leftoverChanges,
    deployResult,
  }
}
