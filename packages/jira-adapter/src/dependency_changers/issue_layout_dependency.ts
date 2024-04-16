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
} from '@salto-io/adapter-api'
import { deployment } from '@salto-io/adapter-components'
import { ISSUE_LAYOUT_TYPE } from '../constants'

const getParent = (instance: InstanceElement): InstanceElement => instance.annotations[CORE_ANNOTATIONS.PARENT][0].value

const getSpecificChange = (
  instance: InstanceElement,
  AdditionOrModificationChanges: deployment.dependency.ChangeWithKey<Change<InstanceElement>>[],
): deployment.dependency.ChangeWithKey<Change<InstanceElement>> | undefined =>
  AdditionOrModificationChanges.find(({ change }) => getChangeData(change).elemID.isEqual(instance.elemID))

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
      (change): change is deployment.dependency.ChangeWithKey<Change<InstanceElement>> =>
        isInstanceChange(change.change) && isAdditionOrModificationChange(change.change),
    )

  const issueLayoutChanges = AdditionOrModificationChanges.filter(
    ({ change }) => getChangeData(change).elemID.typeName === ISSUE_LAYOUT_TYPE,
  )

  const issueLayoutsKeysToProject: Record<number, InstanceElement> = Object.fromEntries(
    issueLayoutChanges.map(({ key, change }) => {
      const parentChange = getSpecificChange(getParent(getChangeData(change)), AdditionOrModificationChanges)
      const project = parentChange !== undefined ? getChangeData(parentChange.change) : getParent(getChangeData(change))

      return [key, project]
    }),
  )

  const issueLayoutsKeysToDependencyKeys = Object.entries(issueLayoutsKeysToProject)
    .flatMap(([issueLayoutKey, project]) => [
      [
        Number(issueLayoutKey),
        getSpecificChange(project.value.issueTypeScreenScheme, AdditionOrModificationChanges)?.key,
      ],
      [Number(issueLayoutKey), getSpecificChange(project.value.issueTypeScheme, AdditionOrModificationChanges)?.key],
    ])
    .filter(
      ([issueLayoutKey, dependencyKeys]) => issueLayoutKey !== undefined && dependencyKeys !== undefined,
    ) as number[][]

  Object.entries(issueLayoutsKeysToProject).forEach(([issueLayoutKey, project]) => {
    const projectIssueTypeScreenSchemeChange = getSpecificChange(
      project.value.issueTypeScreenScheme,
      AdditionOrModificationChanges,
    )
    const projectIssueTypeMapping = projectIssueTypeScreenSchemeChange
      ? getChangeData(projectIssueTypeScreenSchemeChange.change).value.issueTypeMappings
      : project.value.issueTypeScreenScheme.value.value.issueTypeMappings
    const projectScreenSchemes = projectIssueTypeMapping
      ?.map((issueTypeMapping: issueTypeMappingStruct) =>
        getSpecificChange(issueTypeMapping.screenSchemeId, AdditionOrModificationChanges),
      )
      .filter((change: deployment.dependency.ChangeWithKey<Change<InstanceElement>>) => change !== undefined)
      .map((change: deployment.dependency.ChangeWithKey<Change<InstanceElement>>) => change.key)
      .map((changeKey: number) => [Number(issueLayoutKey), changeKey])

    if (projectScreenSchemes !== undefined && projectScreenSchemes.length !== 0) {
      issueLayoutsKeysToDependencyKeys.push(...projectScreenSchemes)
    }
  })

  return issueLayoutsKeysToDependencyKeys.flatMap(([issueLayoutKey, dependencyKey]) => [
    dependencyChange('remove', issueLayoutKey, dependencyKey),
    dependencyChange('add', dependencyKey, issueLayoutKey),
  ])
}
