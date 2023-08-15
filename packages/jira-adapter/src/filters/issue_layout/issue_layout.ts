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
import { CORE_ANNOTATIONS, Element, InstanceElement, ReferenceExpression, isInstanceElement } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { createSchemeGuard, isResolvedReferenceExpression, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as adapterElements, references as referenceUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import JiraClient, { graphQLResponseType } from '../../client/client'
import { JIRA, PROJECT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { QUERY } from './issue_layout_query'
import { ISSUE_LAYOUT_CONFIG_ITEM__SCHEME, ISSUE_LAYOUT_RESPONSE_SCHEME, IssueLayoutConfig, IssueLayoutConfigItem, IssueLayoutResponse, containerIssueLayoutResponse, createIssueLayoutType } from './issue_layout_types'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'
import { JiraConfig } from '../../config/config'
import { referencesRules, JiraFieldReferenceResolver, contextStrategyLookup } from '../../reference_mapping'

const { isDefined } = lowerDashValues

type issueTypeMappingStruct = {
    issueTypeId: string
    screenSchemeId: ReferenceExpression
}

const isIssueLayoutResponse = createSchemeGuard<IssueLayoutResponse>(ISSUE_LAYOUT_RESPONSE_SCHEME, 'Failed to get issue layout from jira service')
const isIssueLayoytConfigItem = createSchemeGuard<IssueLayoutConfigItem>(ISSUE_LAYOUT_CONFIG_ITEM__SCHEME, 'Not a valid issue layout config item')

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
    fieldPropertyKeys: [],
  }
  const response = await client.gqlPost({
    url: baseUrl,
    query: QUERY,
    variables,
  })

  return response
}

const fromIssueLayoutConfigRespToIssueLayoutConfig = (
  containers: containerIssueLayoutResponse[]
):
IssueLayoutConfig => {
  const items = containers.flatMap(container => container.items.nodes.map(node => ({
    type: node.fieldItemId ? 'FIELD' : 'PANEL',
    sectionType: container.containerType,
    key: node.fieldItemId || node.panelItemId,
  }))).filter(isDefined).filter(isIssueLayoytConfigItem)

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
    fieldsToGroupBy: ['id', 'name', 'originalName', 'groupId', 'key'],
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

const filter: FilterCreator = ({ client, config }) => ({
  name: 'issueLayoutFilter',
  onFetch: async elements => {
    const projectToScreenId = await getProjectToScreenMapping(elements)
    const projectIdToProjectName = Object.fromEntries(
      (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
        .filter(isInstanceElement)
        .map(async project => {
          const projectName = project.value.name
          return [project.value.id, projectName]
        })))
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
          const name = `${projectIdToProjectName[projectId]}_${issueLayoutResult.name}`
          const issueLayout = new InstanceElement(
            naclCase(name),
            issueLayoutType,
            {
              id: issueLayoutResult.id,
              projectId,
              extraDefinerId: screenId,
              owners: issueLayoutResult.usageInfo.edges[0].node.layoutOwners.map(owner => owner.id),
              issueLayoutConfig: fromIssueLayoutConfigRespToIssueLayoutConfig(containers),
            },
            [JIRA, adapterElements.RECORDS_PATH, PROJECT_TYPE, 'Layouts', pathNaclCase(name)],
          )
          elements.push(issueLayout)
          await createReferences(config, [issueLayout], elements)
          setTypeDeploymentAnnotations(issueLayoutType)
          await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.CREATABLE)
          await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.UPDATABLE)
          await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.DELETABLE)
        }
      })))
  },
})

export default filter
