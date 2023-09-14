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
import { createSchemeGuard, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import _ from 'lodash'
import JiraClient from '../../client/client'
import { ISSUE_LAYOUT_TYPE, PROJECT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { ISSUE_LAYOUT_RESPONSE_SCHEME, IssueLayoutConfigItem, IssueLayoutResponse, createLayoutType } from './layout_types'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'
import { deployChanges } from '../../deployment/standard_deployment'
import { getLayout, getLayoutResponse } from './layoutsUtils'

const { isDefined } = lowerDashValues


type issueTypeMappingStruct = {
    issueTypeId: string
    screenSchemeId: ReferenceExpression
}

const isIssueLayoutResponse = createSchemeGuard<IssueLayoutResponse>(ISSUE_LAYOUT_RESPONSE_SCHEME)

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

const filter: FilterCreator = ({ client, config, fetchQuery, getElemIdFunc }) => ({
  name: 'issueLayoutFilter',
  onFetch: async elements => {
    if (client.isDataCenter
      || !fetchQuery.isTypeMatch(ISSUE_LAYOUT_TYPE)
      || !config.fetch.enableIssueLayouts) {
      return
    }
    const projectIdToProject = Object.fromEntries(
      (await Promise.all(elements.filter(e => e.elemID.typeName === PROJECT_TYPE)
        .filter(isInstanceElement)
        .filter(project => !project.value.simplified && project.value.projectTypeKey === 'software')
        .map(async project => [project.value.id, project])))
        .filter(isDefined)
    )
    const projectToScreenId = Object.fromEntries(Object.entries(await getProjectToScreenMapping(elements))
      .filter(([key]) => Object.keys(projectIdToProject).includes(key)))
    const { issueLayoutType, subTypes } = createLayoutType(ISSUE_LAYOUT_TYPE)
    elements.push(issueLayoutType)
    subTypes.forEach(type => elements.push(type))

    const issueLayouts = (await Promise.all(Object.entries(projectToScreenId)
      .flatMap(([projectId, screenIds]) => screenIds.map(async screenId => {
        const variables = {
          projectId,
          extraDefinerId: screenId,
        }
        const response = await getLayoutResponse({
          variables,
          client,
        })
        return getLayout({
          variables,
          response,
          instance: projectIdToProject[projectId],
          layoutType: issueLayoutType,
          getElemIdFunc,
          typeName: ISSUE_LAYOUT_TYPE,
        })
      })))).filter(isDefined)
    issueLayouts.forEach(layout => { elements.push(layout) })
    setTypeDeploymentAnnotations(issueLayoutType)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.DELETABLE)
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
