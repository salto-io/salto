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
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { ISSUE_LAYOUT_TYPE } from '../constants'

type issueTypeMappingStruct = {
  issueTypeId: string | ReferenceExpression
  screenSchemeId: ReferenceExpression
}

const parent = (instance: InstanceElement): ElemID => instance.annotations[CORE_ANNOTATIONS.PARENT][0].elemID

// Filters and deletes from the issueTypeMapping the issue layouts that are not in the issueTypeScheme of the project
const isIssueTypeInIssueTypeScreenScheme = (
  issueTypeScreenScheme: issueTypeMappingStruct,
  projectIssueTypesFullName: string[],
): boolean =>
  _.isString(issueTypeScreenScheme.issueTypeId)
    ? issueTypeScreenScheme.issueTypeId === 'default'
    : projectIssueTypesFullName.includes(issueTypeScreenScheme.issueTypeId.elemID.getFullName())

// temporary will be used from the filter
const isRelevantMapping = (
  issueTypeScreenScheme: issueTypeMappingStruct,
  relevantIssueTypeMappingsLength: number,
  projectIssueTypesFullNameLength: number,
): boolean =>
  issueTypeScreenScheme.issueTypeId !== 'default' || relevantIssueTypeMappingsLength <= projectIssueTypesFullNameLength

const issueLayoutByProject = (changes: ReadonlyArray<Change>): InstanceElement[][] =>
  Object.values(
    _.groupBy(
      changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeData)
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === ISSUE_LAYOUT_TYPE),
      instance => parent(instance).getFullName(),
    ),
  )

const getIssueLayoutsScreen = async (
  elementsSource: ReadOnlyElementsSource,
  issueLayout: InstanceElement,
): Promise<string[]> => {
  if (!(await elementsSource.has(parent(issueLayout)))) return []
  const project = await elementsSource.get(parent(issueLayout))
  const projectIssueTypesFullName = (
    await elementsSource.get(project.value.issueTypeScheme.elemID)
  ).value.issueTypeIds.map((issueType: ReferenceExpression) => issueType.elemID.getFullName())

  const relevantIssueTypeMappings = (
    (await Promise.all(
      (await elementsSource.get(project.value.issueTypeScreenScheme.elemID)).value.issueTypeMappings,
    )) as issueTypeMappingStruct[]
  ).filter((issueTypeScreenScheme: issueTypeMappingStruct) =>
    isIssueTypeInIssueTypeScreenScheme(issueTypeScreenScheme, projectIssueTypesFullName),
  )

  const defaultIssueTypeMappingsCheck = relevantIssueTypeMappings.filter(
    (issueTypeScreenScheme: issueTypeMappingStruct) =>
      isRelevantMapping(issueTypeScreenScheme, relevantIssueTypeMappings.length, projectIssueTypesFullName.length),
  )

  return (
    await Promise.all(
      defaultIssueTypeMappingsCheck.map((issueTypeMapping: issueTypeMappingStruct) =>
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

// this custom validator ensures the integrity and correctness of issue layout configurations within projects,
// by validating that each issue layout is linked to a valid screen according to the project's
// issue type scheme and screen scheme settings.

export const issueLayoutsValidator: ChangeValidator = async (changes, elementsSource) => {
  const errors: ChangeError[] = []

  if (elementsSource === undefined) return errors

  const projectIdToIssueLayout: InstanceElement[][] = issueLayoutByProject(changes)

  await Promise.all(
    projectIdToIssueLayout.map(async instances => {
      const issueLayoutsScreen = await getIssueLayoutsScreen(elementsSource, instances[0])

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
