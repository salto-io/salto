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
import {
  CORE_ANNOTATIONS,
  Change,
  Element,
  InstanceElement,
  getChangeData,
  isInstanceChange,
  isInstanceElement,
  isRemovalChange,
  isAdditionChange,
  Value,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { getParent, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import {
  ISSUE_LAYOUT_TYPE,
  ISSUE_TYPE_SCHEMA_NAME,
  ISSUE_TYPE_SCREEN_SCHEME_TYPE,
  PROJECT_TYPE,
  SCREEN_SCHEME_TYPE,
} from '../../constants'
import { FilterCreator } from '../../filter'
import { createLayoutType, LayoutConfigItem } from './layout_types'
import { addAnnotationRecursively, setTypeDeploymentAnnotations } from '../../utils'
import { generateLayoutId, getLayout, getLayoutResponse, isIssueLayoutResponse } from './layout_service_operations'
import { deployChanges } from '../../deployment/standard_deployment'
import JiraClient, { graphQLResponseType } from '../../client/client'
import { JiraConfig } from '../../config/config'

const log = logger(module)
const { isDefined } = lowerDashValues

type issueTypeMappingStruct = {
  issueTypeId: string
  screenSchemeId: string
}

type ResponsesRecord = Record<string, Record<string, Promise<graphQLResponseType>>>

const viewOrDefaultScreen = (screenScheme: InstanceElement): string =>
  screenScheme.value.screens.view ?? screenScheme.value.screens.default

// Check if the issueType of the issueTypeMapping is default or is in the issueTypeScheme of the project
const IsIssueTypeInIssueTypeSchemesOrDefault = (
  issueTypeMapping: issueTypeMappingStruct,
  issueTypeSchemesToIssueTypeList: Record<string, string[]>,
  issueTypeSchemeId: string,
): boolean =>
  issueTypeMapping.issueTypeId === 'default' ||
  issueTypeSchemesToIssueTypeList[issueTypeSchemeId]?.includes(issueTypeMapping.issueTypeId)

// we do not want to filter out the default issueTypeScreenScheme in case there is an issueType that is not in the issueTypeMapping
// we can do it by compare the length of the issueTypeScheme to the length of the issueTypeMapping after we filter the issueTypeMapping
export const isRelevantMapping = (
  issueTypeId: string | ReferenceExpression,
  projectIssueTypeMappingsLength: number,
  projectIssueTypesFullNameLength: number,
): boolean => issueTypeId !== 'default' || projectIssueTypeMappingsLength <= projectIssueTypesFullNameLength

const getProjectToScreenMappingUnresolved = (elements: Element[]): Record<string, number[]> => {
  const screensSchemesToDefaultOrViewScreens = Object.fromEntries(
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === SCREEN_SCHEME_TYPE)
      .filter(
        screenScheme =>
          screenScheme.value.screens?.default !== undefined || screenScheme.value.screens?.view !== undefined,
      )
      .map(screenScheme => [screenScheme.value.id, viewOrDefaultScreen(screenScheme)]),
  )

  const issueTypeScreenSchemesToiIssueTypeMappings = Object.fromEntries(
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === ISSUE_TYPE_SCREEN_SCHEME_TYPE)
      .map(issueTypeScreenScheme => [issueTypeScreenScheme.value.id, issueTypeScreenScheme.value.issueTypeMappings]),
  )

  const issueTypeSchemesToIssueTypeList = Object.fromEntries(
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === ISSUE_TYPE_SCHEMA_NAME)
      .map(issueTypeScheme => [
        issueTypeScheme.value.id,
        issueTypeScheme.value.issueTypeIds?.map(
          (issueTypeIdRecord: Record<string, string>) => issueTypeIdRecord.issueTypeId,
        ),
      ]),
  )

  return Object.fromEntries(
    elements
      .filter(isInstanceElement)
      .filter(e => e.elemID.typeName === PROJECT_TYPE)
      .filter(project => project.value.issueTypeScreenScheme?.issueTypeScreenScheme?.id !== undefined)
      .map(project => [
        project.value.id,
        [
          ...new Set(
            issueTypeScreenSchemesToiIssueTypeMappings[project.value.issueTypeScreenScheme.issueTypeScreenScheme.id]
              .filter((issueTypeMapping: issueTypeMappingStruct) =>
                IsIssueTypeInIssueTypeSchemesOrDefault(
                  issueTypeMapping,
                  issueTypeSchemesToIssueTypeList,
                  project.value.issueTypeScheme?.issueTypeScheme.id,
                ),
              )
              .filter((issueTypeMapping: issueTypeMappingStruct) =>
                isRelevantMapping(
                  issueTypeMapping.issueTypeId,
                  issueTypeScreenSchemesToiIssueTypeMappings[
                    project.value.issueTypeScreenScheme.issueTypeScreenScheme.id
                  ].length,
                  issueTypeSchemesToIssueTypeList[project.value.issueTypeScheme.issueTypeScheme.id].length,
                ),
              )
              .map(
                (issueTypeMapping: issueTypeMappingStruct) =>
                  screensSchemesToDefaultOrViewScreens[issueTypeMapping.screenSchemeId],
              ),
          ),
        ],
      ]),
  )
}

const verifyProjectDeleted = async (projectId: string, client: JiraClient): Promise<boolean> => {
  try {
    const res = await client.get({ url: `/rest/api/3/project/${projectId}` })
    return res.status === 404
  } catch (error) {
    if (error instanceof clientUtils.HTTPError && error.response?.status === 404) {
      return true
    }
    throw error
  }
}

const deployLayoutChange = async (change: Change<InstanceElement>, client: JiraClient): Promise<void> => {
  const layout = getChangeData(change)
  const { typeName } = layout.elemID
  if (typeName !== ISSUE_LAYOUT_TYPE) {
    return
  }
  const parentProject = getParent(layout)
  if (isRemovalChange(change)) {
    // if parent project removed, IssueLayout was deleted by delete cascade in Jira
    if (_.isString(parentProject.value.id) && (await verifyProjectDeleted(parentProject.value.id, client))) {
      log.debug(
        `Project ${parentProject.elemID.getFullName()} deleted, IssueLayout ${layout.elemID.getFullName()} marked as deployed`,
      )
      return
    }
    // TODO SALTO-5205 - suppress removals of IssueLayout when associated Screen is deleted from IssueTypeScreenScheme
    throw new Error('Could not remove IssueLayout')
  }
  const items = layout.value.issueLayoutConfig?.items
    .map((item: LayoutConfigItem) => {
      if (isResolvedReferenceExpression(item.key)) {
        const key = item.key.value.value.id
        return {
          type: item.type,
          sectionType: item.sectionType.toLocaleLowerCase(),
          key,
          data: {
            name: item.key.value.value.name,
            type:
              item.key.value.value.type ??
              item.key.value.value.schema?.system ??
              item.key.value.value.name.toLowerCase(),
            ...item.data,
          },
        }
      }
      return undefined
    })
    .filter(isDefined)

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
    const variables = {
      projectId: parentProject.value.id,
      extraDefinerId: layout.value.extraDefinerId.value.value.id,
    }
    if (isAdditionChange(change)) {
      layout.value.id = generateLayoutId(variables)
    }
    const response = await getLayoutResponse({ variables, client, typeName })
    if (!isIssueLayoutResponse(response.data)) {
      log.error('received invalid response from jira', response)
      throw Error(
        'Failed to deploy issue layout changes due to an unexpected response from Jira. Your target environment might not be synced, please fetch it and try again.',
      )
    }
    const issueLayoutId = response.data.issueLayoutConfiguration.issueLayoutResult.id
    const url = `/rest/internal/1.0/issueLayouts/${issueLayoutId}`
    await client.put({ url, data })
    return
  }
  throw Error('Failed to deploy issue layout changes due to missing references')
}

const getProjectIdToProjectDict = (elements: Element[]): Value =>
  Object.fromEntries(
    elements
      .filter(e => e.elemID.typeName === PROJECT_TYPE)
      .filter(isInstanceElement)
      .filter(project => !project.value.simplified && project.value.projectTypeKey === 'software')
      .map(project => [project.value.id, project])
      .filter(isDefined),
  )

export const getLayoutRequestsAsync = (
  client: JiraClient,
  config: JiraConfig,
  fetchQuery: elementUtils.query.ElementQuery,
  elements: Element[],
): ResponsesRecord => {
  if (client.isDataCenter || !fetchQuery.isTypeMatch(ISSUE_LAYOUT_TYPE) || !config.fetch.enableIssueLayouts) {
    return {}
  }

  const projectIdToProject = getProjectIdToProjectDict(elements)

  const projectToScreenId = Object.fromEntries(
    Object.entries(getProjectToScreenMappingUnresolved(elements)).filter(([key]) =>
      Object.keys(projectIdToProject).includes(key),
    ),
  )

  const requests: ResponsesRecord = Object.fromEntries(
    Object.entries(projectToScreenId).map(([projectId, screenIds]) => [
      projectId,
      Object.fromEntries(
        screenIds.map(screenId => [
          screenId,
          getLayoutResponse({
            variables: {
              projectId,
              extraDefinerId: screenId,
            },
            client,
            typeName: ISSUE_LAYOUT_TYPE,
          }),
        ]),
      ),
    ]),
  )
  return requests
}

const filter: FilterCreator = ({ client, config, fetchQuery, getElemIdFunc, adapterContext }) => ({
  name: 'issueLayoutFilter',
  onFetch: async elements => {
    if (client.isDataCenter || !fetchQuery.isTypeMatch(ISSUE_LAYOUT_TYPE) || !config.fetch.enableIssueLayouts) {
      return
    }
    const projectIdToProject = getProjectIdToProjectDict(elements)
    const { subTypes, layoutType: issueLayoutType } = createLayoutType(ISSUE_LAYOUT_TYPE)
    elements.push(issueLayoutType)
    subTypes.forEach(type => elements.push(type))
    const responses = adapterContext.layoutsPromise as ResponsesRecord

    const issueLayouts = (
      await Promise.all(
        Object.entries(responses).flatMap(([projectId, projectScreens]) =>
          Object.entries(projectScreens).map(async ([screenId, responsePromise]) => {
            if (projectIdToProject[projectId] === undefined) {
              log.info(`Project with id ${projectId} was not found in projectIdToProject`) // happens due to SALTO-5871
              return undefined
            }
            const response = await responsePromise
            const layoutInstance = await getLayout({
              extraDefinerId: screenId,
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
          }),
        ),
      )
    ).filter(isDefined)
    issueLayouts.forEach(layout => {
      elements.push(layout)
    })
    setTypeDeploymentAnnotations(issueLayoutType)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.CREATABLE)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.UPDATABLE)
    await addAnnotationRecursively(issueLayoutType, CORE_ANNOTATIONS.DELETABLE)
  },
  deploy: async changes => {
    const [issueLayoutsChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === ISSUE_LAYOUT_TYPE,
    )
    const deployResult = await deployChanges(issueLayoutsChanges.filter(isInstanceChange), async change =>
      deployLayoutChange(change, client),
    )

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
