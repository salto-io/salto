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

import { logger } from '@salto-io/logging'
import { ElemIdGetter, InstanceElement, ObjectType, Element, isInstanceElement, CORE_ANNOTATIONS, Value } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { createSchemeGuard, getParent, hasValidParent, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as adapterElements, config as configUtils } from '@salto-io/adapter-components'
import { FilterResult } from '@salto-io/adapter-utils/src/filter'
import _ from 'lodash'
import { setTypeDeploymentAnnotations, addAnnotationRecursively } from '../../utils'
import { JiraConfig } from '../../config/config'
import JiraClient, { graphQLResponseType } from '../../client/client'
import { QUERY, QUERY_JSM } from './layout_queries'
import { ISSUE_LAYOUT_CONFIG_ITEM_SCHEME, ISSUE_LAYOUT_RESPONSE_SCHEME, LayoutConfigItem, IssueLayoutResponse, createLayoutType, IssueLayoutConfiguration, IssueLayoutConfig } from './layout_types'
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
const isLayoutConfigItem = createSchemeGuard<LayoutConfigItem>(ISSUE_LAYOUT_CONFIG_ITEM_SCHEME)

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
    return await client.gqlPost({
      url: baseUrl,
      query,
      variables,
    })
  } catch (e) {
    log.error(`Failed to get issue layout for project ${variables.projectId} and screen ${variables.extraDefinerId}: ${e}`)
  }
  return { data: undefined }
}

const fromLayoutConfigRespToLayoutConfig = (
  layoutConfig: IssueLayoutConfiguration
): IssueLayoutConfig => {
  const { containers } = layoutConfig.issueLayoutResult
  const fieldItemIdToMetaData: Record<string, Value> = Object.fromEntries(
    (layoutConfig.metadata?.configuration.items.nodes ?? [])
      .filter(node => !_.isEmpty(node))
      .map(node => [node.fieldItemId, _.omit(node, 'fieldItemId')])
  )
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

interface LayoutIdParts {
  projectId: string | number
  extraDefinerId: string | number
}

// IssueLayout external ids are changed frequently, so we want to fix it internally
export const generateLayoutId = (
  { projectId, extraDefinerId }: LayoutIdParts
): string => projectId.toString().concat('_', extraDefinerId.toString())

export const getLayout = async ({
  extraDefinerId,
  response,
  instance,
  layoutType,
  getElemIdFunc,
  typeName,
}: {
  extraDefinerId: string | number
  response: graphQLResponseType
  instance: InstanceElement
  layoutType: ObjectType
  getElemIdFunc?: ElemIdGetter | undefined
  typeName: LayoutTypeName
}): Promise<InstanceElement | undefined> => {
  if (!Array.isArray(response.data) && isIssueLayoutResponse(response.data) && instance.path !== undefined) {
    const { issueLayoutResult } = response.data.issueLayoutConfiguration
    const value = {
      id: typeName !== ISSUE_LAYOUT_TYPE ? issueLayoutResult.id : generateLayoutId(
        { projectId: instance.value.id, extraDefinerId }
      ),
      extraDefinerId,
      issueLayoutConfig: fromLayoutConfigRespToLayoutConfig(response.data.issueLayoutConfiguration),
    }
    const name = `${instance.value.name}_${issueLayoutResult.name}`
    const serviceIds = adapterElements.createServiceIds({ entry: value, serviceIdFields: ['id'], typeID: layoutType.elemID })
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
      .filter(requestType => hasValidParent(requestType))
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
        extraDefinerId: variables.extraDefinerId,
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
