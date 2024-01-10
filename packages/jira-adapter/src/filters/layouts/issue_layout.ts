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
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { CORE_ANNOTATIONS, Change, Element, InstanceElement, ReferenceExpression, getChangeData, isAdditionChange, isInstanceChange, isInstanceElement, isRemovalChange } from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { getParent, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { ISSUE_LAYOUT_TYPE, PROJECT_TYPE } from '../../constants'
import { FilterCreator } from '../../filter'
import { createLayoutType, layoutConfigItem } from './layout_types'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'
import { getLayout, getLayoutResponse, isIssueLayoutResponse } from './layout_service_operations'
import { deployChanges } from '../../deployment/standard_deployment'
import JiraClient from '../../client/client'

const log = logger(module)
const { isDefined } = lowerDashValues

type issueTypeMappingStruct = {
    issueTypeId: string
    screenSchemeId: ReferenceExpression
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

        const screens = Array.from(new Set(screenSchemes
          .map(screenScheme => screenScheme.value.screens.default)
          .filter(isResolvedReferenceExpression)
          .map(defaultScreen => defaultScreen.value.value.id)))
        return [project.value.id, screens]
      })))
  )
  return projectToScreenId
}

const verifyProjectDeleted = async (
  projectId: string,
  client: JiraClient,
): Promise<boolean> => {
  try {
    const res = await client.getSinglePage({ url: `/rest/api/3/project/${projectId}` })
    return res.status === 404
  } catch (error) {
    if (error instanceof clientUtils.HTTPError && error.response?.status === 404) {
      return true
    }
    throw error
  }
}

const deployLayoutChange = async (
  change: Change<InstanceElement>,
  client: JiraClient,
): Promise<void> => {
  const layout = getChangeData(change)
  const { typeName } = layout.elemID
  if (typeName !== ISSUE_LAYOUT_TYPE) {
    return
  }
  const parentProject = getParent(layout)
  if (isRemovalChange(change)) {
    // if parent project removed, IssueLayout was deleted by delete cascade in Jira
    if (_.isString(parentProject.value.id) && await verifyProjectDeleted(parentProject.value.id, client)) {
      log.debug(`Project ${parentProject.elemID.getFullName()} deleted, IssueLayout ${layout.elemID.getFullName()} marked as deployed`)
      return
    }
    // TODO SALTO-5205 - suppress removals of IssueLayout when associated Screen is deleted from IssueTypeScreenScheme
    throw new Error('Could not remove IssueLayout')
  }
  const items = layout.value.issueLayoutConfig?.items.map((item: layoutConfigItem) => {
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

  if (isResolvedReferenceExpression(layout.value.extraDefinerId)) {
    const data = {
      projectId: parentProject.value.id,
      extraDefinerId: layout.value.extraDefinerId.value.value.id,
      issueLayoutType: 'ISSUE_VIEW',
      owners: [],
      issueLayoutConfig: {
        items,
      },
    }
    if (isAdditionChange(change)) {
      const variables = {
        projectId: parentProject.value.id,
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
    return
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
    const { subTypes, layoutType: issueLayoutType } = createLayoutType(ISSUE_LAYOUT_TYPE)
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
          typeName: ISSUE_LAYOUT_TYPE,
        })
        const layoutInstance = await getLayout({
          extraDefinerId: variables.extraDefinerId,
          response,
          instance: projectIdToProject[projectId],
          layoutType: issueLayoutType,
          getElemIdFunc,
          typeName: ISSUE_LAYOUT_TYPE,
        })
        if (layoutInstance !== undefined) {
          const projectKey = projectIdToProject[projectId]?.value.key
          const url = `/plugins/servlet/project-config/${projectKey}/issuelayout?screenId=${layoutInstance.value.extraDefinerId}`
          layoutInstance.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, client.baseUrl).href
        }
        return layoutInstance
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
      async change => deployLayoutChange(change, client))

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
