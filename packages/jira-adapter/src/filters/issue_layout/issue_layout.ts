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
import { CORE_ANNOTATIONS, Change, Element, InstanceElement, ReferenceExpression, getChangeData, isAdditionChange, isInstanceChange, isInstanceElement } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createSchemeGuard, isResolvedReferenceExpression, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as adapterElements, references as referenceUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import JiraClient, { graphQLResponseType } from '../../client/client'
import { ISSUE_LAYOUT_TYPE, JIRA, PROJECT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { QUERY } from './issue_layout_query'
import { ISSUE_LAYOUT_CONFIG_ITEM_SCHEME, ISSUE_LAYOUT_RESPONSE_SCHEME, IssueLayoutConfig, IssueLayoutConfigItem, IssueLayoutResponse, containerIssueLayoutResponse, createIssueLayoutType } from './issue_layout_types'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'
import { JiraConfig } from '../../config/config'
import { referencesRules, JiraFieldReferenceResolver, contextStrategyLookup } from '../../reference_mapping'
import { deployChanges } from '../../deployment/standard_deployment'

const { isDefined } = lowerDashValues
const log = logger(module)

type issueTypeMappingStruct = {
    issueTypeId: string
    screenSchemeId: ReferenceExpression
}

const isIssueLayoutResponse = createSchemeGuard<IssueLayoutResponse>(ISSUE_LAYOUT_RESPONSE_SCHEME, 'Failed to get issue layout from jira service')
const isIssueLayoutConfigItem = createSchemeGuard<IssueLayoutConfigItem>(ISSUE_LAYOUT_CONFIG_ITEM_SCHEME)

const getIssueLayout = async ({
  projectId,
  screenId,
  client,
}:{
    projectId: number
    screenId: number
    client: JiraClient
  }):
  Promise<graphQLResponseType> => {
  const baseUrl = '/rest/gira/1'
  const variables = {
    projectId,
    extraDefinerId: screenId,
  }
  try {
    const response = await client.gqlPost({
      url: baseUrl,
      query: QUERY,
      variables,
    })
    return response
  } catch (e) {
    log.error(`Failed to get issue layout for project ${projectId} and screen ${screenId}: ${e}`)
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

const createReferences = async (
  config: JiraConfig, elements: Element[], contextElements: Element[]): Promise<void> => {
  const fixedDefs = referencesRules
    .map(def => (
      config.fetch.enableMissingReferences ? def : _.omit(def, 'jiraMissingRefStrategy')
    ))
  await referenceUtils.addReferences({
    elements,
    contextElements,
    fieldsToGroupBy: ['id'],
    defs: fixedDefs,
    contextStrategyLookup,
    fieldReferenceResolverCreator: defs => new JiraFieldReferenceResolver(defs),
  })
}

const getProjectToScreenMapping = async (elements: Element[]): Promise<Record<string, number[]>> => {
  const projectToScreenId: Record<string, number[]> = Object.fromEntries(
    (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
      .filter(isInstanceElement)
      .filter(project => isResolvedReferenceExpression(project.value.issueTypeScreenScheme))
      .map(async project => {
        const screenSchemes = (project.value.issueTypeScreenScheme.value
          .value.issueTypeMappings
          .flatMap((struct: issueTypeMappingStruct) => struct.screenSchemeId.value) as unknown[])
          .filter(isInstanceElement)

        const screens = screenSchemes.map(screenScheme => screenScheme.value.screens.default.value.value.id)
        return [project.value.id, screens]
      })))
  )
  return projectToScreenId
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
      const response = await getIssueLayout({ projectId: issueLayout.value.projectId.value.value.id,
        screenId: issueLayout.value.extraDefinerId.value.value.id,
        client })
      if (!isIssueLayoutResponse(response.data)) {
        return undefined
      }
      issueLayout.value.id = response.data.issueLayoutConfiguration.issueLayoutResult.id
    }
    const url = `/rest/internal/1.0/issueLayouts/${issueLayout.value.id}`
    await client.put({ url, data })
  }
  return undefined
}

const filter: FilterCreator = ({ client, config, fetchQuery, getElemIdFunc }) => ({
  name: 'issueLayoutFilter',
  onFetch: async elements => {
    if (client.isDataCenter || !fetchQuery.isTypeMatch(ISSUE_LAYOUT_TYPE)) {
      return
    }
    const projectToScreenId = await getProjectToScreenMapping(elements)
    const projectIdToProject = Object.fromEntries(
      (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
        .filter(isInstanceElement)
        .map(async project => [project.value.id, project])))
        .filter(isDefined)
    )
    const { issueLayoutType, subTypes } = createIssueLayoutType()
    elements.push(issueLayoutType)
    subTypes.forEach(type => elements.push(type))

    await Promise.all(Object.entries(projectToScreenId)
      .flatMap(([projectId, screenIds]) => screenIds.map(async screenId => {
        const response = await getIssueLayout({
          projectId: Number(projectId),
          screenId,
          client,
        })
        if (!Array.isArray(response.data) && isIssueLayoutResponse(response.data)) {
          const { issueLayoutResult } = response.data.issueLayoutConfiguration
          const { containers } = issueLayoutResult
          const value = {
            id: issueLayoutResult.id,
            projectId,
            extraDefinerId: screenId,
            owners: issueLayoutResult.usageInfo.edges[0].node.layoutOwners.map(owner => owner.id),
            issueLayoutConfig: fromIssueLayoutConfigRespToIssueLayoutConfig(containers),
          }
          const name = `${projectIdToProject[projectId].value.name}_${issueLayoutResult.name}`
          const serviceIds = adapterElements.createServiceIds(value, 'id', issueLayoutType.elemID)
          const instanceName = getElemIdFunc ? getElemIdFunc(JIRA, serviceIds, naclCase(name)).name
            : naclCase(name)
          const issueLayout = new InstanceElement(
            instanceName,
            issueLayoutType,
            value,
            [...projectIdToProject[projectId].path.slice(0, -1), 'layouts', pathNaclCase(instanceName)],
          )
          elements.push(issueLayout)
          await createReferences(config, [issueLayout], elements)
          setTypeDeploymentAnnotations(issueLayoutType)
          await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.CREATABLE)
          await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.UPDATABLE)
          issueLayoutType.fields.owners.annotations[CORE_ANNOTATIONS.UPDATABLE] = false
          await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.DELETABLE)
        }
      })))
  },
  deploy: async changes => {
    const [issueLayoutsChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === ISSUE_LAYOUT_TYPE
    )
    const deployResult = await deployChanges(issueLayoutsChanges.filter(isInstanceChange),
      async change => deployIssueLayoutChanges(change, client))

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
