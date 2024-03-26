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
} from '@salto-io/adapter-api'

import _ from 'lodash'

import { ISSUE_LAYOUT_TYPE } from '../constants'

type issueTypeMappingStruct = {
  issueTypeId: string | ReferenceExpression
  screenSchemeId: ReferenceExpression
}

const getParent = async (instance: InstanceElement, elementsSource: ReadOnlyElementsSource): Promise<InstanceElement> =>
  elementsSource.get(instance.annotations[CORE_ANNOTATIONS.PARENT][0].elemID)

// Filters and deletes from the issueTypeMapping the issue layouts that are not in the issueTypeScheme of the project
const intersectionOfIssueType = (
  issueTypeScreenScheme: issueTypeMappingStruct,
  projectIssueTypesFullName: string[],
): boolean =>
  _.isString(issueTypeScreenScheme.issueTypeId)
    ? issueTypeScreenScheme.issueTypeId === 'default'
    : projectIssueTypesFullName.includes(issueTypeScreenScheme.issueTypeId.elemID.getFullName())

// It only leaves the deductive issueTypeScreenScheme if there is an issueType found in the project's issueTypeScheme but not in the issueTypeMapping
// If there is such a case, it means that the length of the issueTypeScheme is greater than the length of the issueTypeMapping (after the last filter)
const isScreenOfViewOrDefaultIssueTypeScreenScheme = (
  issueTypeScreenScheme: issueTypeMappingStruct,
  relevantIssueTypeMappingsLength: number,
  projectIssueTypesFullNameLength: number,
): boolean =>
  issueTypeScreenScheme.issueTypeId !== 'default' || relevantIssueTypeMappingsLength <= projectIssueTypesFullNameLength

const getProjectIdToIssueLayout = (
  changes: ReadonlyArray<Change>,
  elementsSource: ReadOnlyElementsSource,
): Record<string, InstanceElement[]> =>
  _.groupBy(
    changes
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isInstanceElement)
      .filter(async instance => instance.elemID.typeName === ISSUE_LAYOUT_TYPE),
    async instance => (await getParent(instance, elementsSource)).value.elemID,
  )

const getIssueLayoutsScreen = async (
  elementsSource: ReadOnlyElementsSource,
  project: InstanceElement,
): Promise<string[]> => {
  if (project === undefined) return []
  const projectIssueTypesFullName = (
    await elementsSource.get(project.value.issueTypeScheme.elemID)
  ).value.issueTypeIds.map((issueType: ReferenceExpression) => issueType.elemID.getFullName())

  const relevantIssueTypeMappings = (
    (await Promise.all(
      (await elementsSource.get(project.value.issueTypeScreenScheme.elemID)).value.issueTypeMappings,
    )) as issueTypeMappingStruct[]
  ).filter((issueTypeScreenScheme: issueTypeMappingStruct) =>
    intersectionOfIssueType(issueTypeScreenScheme, projectIssueTypesFullName),
  )

  const defaultCheckIssueTypeMappings = relevantIssueTypeMappings.filter(
    (issueTypeScreenScheme: issueTypeMappingStruct) =>
      isScreenOfViewOrDefaultIssueTypeScreenScheme(
        issueTypeScreenScheme,
        relevantIssueTypeMappings.length,
        projectIssueTypesFullName.length,
      ),
  )

  return (
    await Promise.all(
      defaultCheckIssueTypeMappings.map((issueTypeMapping: issueTypeMappingStruct) =>
        elementsSource.get(issueTypeMapping.screenSchemeId.elemID),
      ),
    )
  )
    .filter(isInstanceElement)
    .filter(
      (screenScheme: InstanceElement) =>
        screenScheme.value.screens.default !== undefined || screenScheme.value.screens.view !== undefined,
    )
    .flatMap((screenScheme: InstanceElement) => screenScheme.value.screens.view ?? screenScheme.value.screens.default)
    .map((screen: ReferenceExpression) => screen.elemID.getFullName())
}

export const issueLayoutsValidator: ChangeValidator = async (changes, elementsSource) => {
  const errors: ChangeError[] = []

  if (elementsSource === undefined) return errors

  const projectIdToIssueLayout: Record<string, InstanceElement[]> = getProjectIdToIssueLayout(changes, elementsSource)

  await Promise.all(
    Object.values(projectIdToIssueLayout).map(async instances => {
      const issueLayoutsScreen = await getIssueLayoutsScreen(
        elementsSource,
        await getParent(instances[0], elementsSource),
      )
      await Promise.all(
        instances.map(async instance => {
          if (!issueLayoutsScreen.includes(instance.value.extraDefinerId.elemID.getFullName())) {
            errors.push({
              elemID: instance.elemID,
              severity: 'Error',
              message: 'Invalid screen in Issue Layout',
              detailedMessage: `Issue layout ${instance.elemID.getFullName()} references an invalid or non-existing screen.`,
            })
          }
        }),
      )
    }),
  )

  return errors
}
