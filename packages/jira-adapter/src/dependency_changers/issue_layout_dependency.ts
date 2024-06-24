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
  dependencyChange,
  DependencyChanger,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  CORE_ANNOTATIONS,
  ElemID,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { ISSUE_LAYOUT_TYPE } from '../constants'

type ChangeWithKey = deployment.dependency.ChangeWithKey<Change<InstanceElement>>

const getParent = (instance: InstanceElement): InstanceElement =>
  instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.value

const getSpecificChange = (
  elemId: ElemID | undefined,
  AdditionOrModificationChanges: ChangeWithKey[],
): ChangeWithKey | undefined =>
  elemId === undefined
    ? undefined
    : AdditionOrModificationChanges.find(({ change }) => getChangeData(change).elemID.isEqual(elemId))

type issueTypeMappingStruct = {
  issueTypeId: string | InstanceElement
  screenSchemeId: InstanceElement
}

/**
 * Make sure issue layout dependencies are updated before the issue layout is updated
 */
export const issueLayoutDependencyChanger: DependencyChanger = async changes => {
  const AdditionOrModificationChanges = Array.from(changes.entries())
    .map(([key, change]) => ({ key, change }))
    .filter(
      (change): change is ChangeWithKey =>
        isInstanceChange(change.change) && isAdditionOrModificationChange(change.change),
    )

  const issueLayoutsKeysToProject = Object.fromEntries(
    AdditionOrModificationChanges.filter(({ change }) => getChangeData(change).elemID.typeName === ISSUE_LAYOUT_TYPE)
      .map(({ key, change }) => [key, getParent(getChangeData(change))])
      .filter(([_, project]) => project !== undefined) as [string, InstanceElement][],
  )

  const issueLayoutsKeysToDependencyKeys = Object.entries(issueLayoutsKeysToProject)
    .flatMap(([issueLayoutKey, project]) => [
      [
        issueLayoutKey,
        getSpecificChange(project.value.issueTypeScreenScheme?.elemID, AdditionOrModificationChanges)?.key,
      ],
      [issueLayoutKey, getSpecificChange(project.value.issueTypeScheme?.elemID, AdditionOrModificationChanges)?.key],
    ])
    .filter(
      ([issueLayoutKey, dependencyKeys]) => issueLayoutKey !== undefined && dependencyKeys !== undefined,
    ) as string[][]

  Object.entries(issueLayoutsKeysToProject).forEach(([issueLayoutKey, project]) => {
    const issueLayoutKeyToProjectScreenSchemesKeys = isReferenceExpression(project.value.issueTypeScreenScheme)
      ? project.value.issueTypeScreenScheme.value.value.issueTypeMappings
          ?.map((issueTypeMapping: issueTypeMappingStruct) =>
            getSpecificChange(issueTypeMapping.screenSchemeId?.elemID, AdditionOrModificationChanges),
          )
          .filter((change: ChangeWithKey) => change !== undefined)
          .map((change: ChangeWithKey) => [issueLayoutKey, change.key])
      : undefined

    if (
      issueLayoutKeyToProjectScreenSchemesKeys !== undefined &&
      issueLayoutKeyToProjectScreenSchemesKeys.length !== 0
    ) {
      issueLayoutsKeysToDependencyKeys.push(...issueLayoutKeyToProjectScreenSchemesKeys)
    }
  })

  return issueLayoutsKeysToDependencyKeys.flatMap(([issueLayoutKey, dependencyKey]) => [
    dependencyChange('add', issueLayoutKey, dependencyKey),
  ])
}
