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
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
  ReferenceExpression,
  ReadOnlyElementsSource,
  CORE_ANNOTATIONS,
  ElemID,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { ISSUE_LAYOUT_TYPE } from '../constants'
import JiraClient from '../client/client'
import { JiraConfig } from '../config/config'
import { isRelevantMapping } from '../filters/layouts/issue_layout'

const log = logger(module)

type issueTypeMappingStruct = {
  issueTypeId: string | ReferenceExpression
  screenSchemeId: ReferenceExpression
}

const parentElemID = (instance: InstanceElement): ElemID | undefined =>
  instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.elemID

// Check if issueType in the issueTypeScheme of the project or default
const isIssueTypeDefaultOrInIssueTypeScheme = (
  issueTypeId: ReferenceExpression | string,
  projectIssueTypesFullName: string[],
): boolean =>
  isReferenceExpression(issueTypeId)
    ? projectIssueTypesFullName?.includes(issueTypeId?.elemID.getFullName())
    : issueTypeId === 'default'

// Do not filter issueLayouts that their parentElemID is undefined because the code after use them to push error
const getIssueLayoutsListByProject = (changes: ReadonlyArray<Change>): InstanceElement[][] =>
  Object.values(
    _.groupBy(
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === ISSUE_LAYOUT_TYPE),
      instance => parentElemID(instance)?.getFullName(),
    ),
  )

const getProjectIssueLayoutsScreensName = async (
  elementsSource: ReadOnlyElementsSource,
  projectElemID: ElemID | undefined,
): Promise<string[]> => {
  const project = projectElemID !== undefined ? await elementsSource.get(projectElemID) : undefined
  if (
    project?.value.issueTypeScheme === undefined ||
    project.value.issueTypeScreenScheme === undefined ||
    !isReferenceExpression(project.value.issueTypeScreenScheme) ||
    !isReferenceExpression(project.value.issueTypeScheme)
  ) {
    return []
  }
  const projectIssueTypesFullName = (await elementsSource.get(project.value.issueTypeScheme.elemID))?.value.issueTypeIds
    ?.filter(isReferenceExpression)
    ?.map((issueType: ReferenceExpression) => issueType.elemID.getFullName())

  const relevantIssueTypeMappings = (
    (await Promise.all(
      (await elementsSource.get(project.value.issueTypeScreenScheme.elemID))?.value.issueTypeMappings ?? [],
    )) as issueTypeMappingStruct[]
  ).filter(issueTypeMappingsElement =>
    isIssueTypeDefaultOrInIssueTypeScheme(issueTypeMappingsElement.issueTypeId, projectIssueTypesFullName),
  )

  return (
    await Promise.all(
      relevantIssueTypeMappings
        .filter(issueTypeMappingsElement =>
          isRelevantMapping(
            issueTypeMappingsElement.issueTypeId,
            relevantIssueTypeMappings.length,
            projectIssueTypesFullName.length,
          ),
        )
        .filter(issueTypeMappingsElement => isReferenceExpression(issueTypeMappingsElement.screenSchemeId))
        .map(async issueTypeMappingsElement => elementsSource.get(issueTypeMappingsElement.screenSchemeId.elemID)),
    )
  )
    .filter(isInstanceElement)
    .filter(
      screenScheme =>
        screenScheme.value.screens?.default !== undefined || screenScheme.value.screens?.view !== undefined,
    )
    .flatMap(screenScheme => screenScheme.value.screens.view ?? screenScheme.value.screens.default)
    .filter(isReferenceExpression)
    .map((screen: ReferenceExpression) => screen.elemID.getFullName())
}

// this change validator ensures the correctness of issue layout configurations within each project,
// by validating that each issue layout is linked to a valid screen according to his specific project
// we also check that the issue layout is linked to a relevant project
export const issueLayoutsValidator: (client: JiraClient, config: JiraConfig) => ChangeValidator =
  (client, config) => async (changes, elementsSource) => {
    const errors: ChangeError[] = []
    if (client.isDataCenter || !config.fetch.enableIssueLayouts || elementsSource === undefined) {
      log.info('Issue Layouts validation is disabled')
      return errors
    }

    await Promise.all(
      getIssueLayoutsListByProject(changes).map(async issueLayoutsByProject => {
        // I use the first issueLayout of the sub-list of the issueLayouts to get the projectId of the project that this issueLayouts linked to
        // and I need to do it just for the first issueLayout because all the issueLayouts in this sub-list are linked to the same project
        const issueLayoutsScreens = await getProjectIssueLayoutsScreensName(
          elementsSource,
          parentElemID(issueLayoutsByProject[0]),
        )

        issueLayoutsByProject
          .filter(
            issueLayoutInstance =>
              !isReferenceExpression(issueLayoutInstance.value.extraDefinerId) ||
              !issueLayoutsScreens.includes(issueLayoutInstance.value.extraDefinerId.elemID.getFullName()),
          )
          .map(async issueLayoutInstance => {
            errors.push({
              elemID: issueLayoutInstance.elemID,
              severity: 'Error',
              message: 'Invalid screen for Issue Layout',
              detailedMessage:
                `This issue layout references a screen (${issueLayoutInstance.value.extraDefinerId?.elemID?.getFullName()})` +
                ` that is not associated with its project (${parentElemID(issueLayoutInstance)?.getFullName()}). Learn more at https://help.salto.io/en/articles/9306685-deploying-issue-layouts`,
            })
          })
      }),
    )

    return errors
  }
