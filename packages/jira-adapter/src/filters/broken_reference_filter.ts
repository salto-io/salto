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
  ChangeDataType,
  ReferenceExpression,
  Value,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import _ from 'lodash'
import {
  AUTOMATION_TYPE,
  BEHAVIOR_TYPE,
  SCRIPTED_FIELD_TYPE,
  SCRIPT_FRAGMENT_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
} from '../constants'
import { FilterCreator } from '../filter'

export type ProjectType = { projectId: ReferenceExpression }

export const isProjectType = (element: unknown): element is ProjectType => {
  const projectId = _.get(element, 'projectId')
  return projectId !== undefined && isReferenceExpression(projectId)
}

export const isProjectReferenceBroken = (project: ProjectType): boolean =>
  !isResolvedReferenceExpression(project.projectId)

export type BrokenReferenceInfo = {
  location: string
  filter: (item: unknown) => boolean
  namePath: string
  referencesTypeName: string
  singleReferenceTypeName: string
  mustHaveReference: boolean
}
export const BROKEN_REFERENCE_TYPE_MAP: Record<string, BrokenReferenceInfo[]> = {
  [AUTOMATION_TYPE]: [
    {
      location: 'projects',
      filter: (project: unknown): boolean => isProjectType(project) && isProjectReferenceBroken(project),
      namePath: 'projectId.value.target.name',
      referencesTypeName: 'projects',
      singleReferenceTypeName: 'project',
      mustHaveReference: true,
    },
  ],
  [SCRIPT_RUNNER_LISTENER_TYPE]: [
    {
      location: 'projects',
      filter: (project: unknown): boolean => !isResolvedReferenceExpression(project),
      namePath: 'value.target.name',
      referencesTypeName: 'projects',
      singleReferenceTypeName: 'project',
      mustHaveReference: false,
    },
  ],
  [SCRIPTED_FIELD_TYPE]: [
    {
      location: 'issueTypes',
      filter: (issueTypeId: unknown): boolean => !isResolvedReferenceExpression(issueTypeId),
      namePath: 'value.target.name',
      referencesTypeName: 'issue types',
      singleReferenceTypeName: 'issue type',
      mustHaveReference: true,
    },
    {
      location: 'projectKeys',
      filter: (project: unknown): boolean => !isResolvedReferenceExpression(project),
      namePath: 'value.target.name',
      referencesTypeName: 'projects',
      singleReferenceTypeName: 'project',
      mustHaveReference: true,
    },
  ],
  [BEHAVIOR_TYPE]: [
    {
      location: 'issueTypes',
      filter: (issueTypeId: unknown): boolean => !isResolvedReferenceExpression(issueTypeId),
      namePath: 'value.target.name',
      referencesTypeName: 'issue types',
      singleReferenceTypeName: 'issue type',
      mustHaveReference: true,
    },
    {
      location: 'projects',
      filter: (project: unknown): boolean => !isResolvedReferenceExpression(project),
      namePath: 'value.target.name',
      referencesTypeName: 'projects',
      singleReferenceTypeName: 'project',
      mustHaveReference: true,
    },
  ],
  [SCRIPT_FRAGMENT_TYPE]: [
    {
      location: 'entities',
      filter: (project: unknown): boolean => !isResolvedReferenceExpression(project),
      namePath: 'value.target.name',
      referencesTypeName: 'projects',
      singleReferenceTypeName: 'project',
      mustHaveReference: true,
    },
  ],
}

// we allow broken references in some cases, for instance between Automation to Project,
// so in this filter we remove those broken references in preDeploy and add them back in onDeploy
export const filter: FilterCreator = () => {
  const preDeployReferences: Record<string, Value> = {}
  return {
    name: 'BrokenReferenceFilter',
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      Object.entries(BROKEN_REFERENCE_TYPE_MAP).forEach(([typeName, typeInfos]) => {
        typeInfos.forEach(typeInfo => {
          changes
            .filter(isInstanceChange)
            .filter(isAdditionOrModificationChange)
            .filter(change => getChangeData(change).elemID.typeName === typeName)
            .filter(change => getChangeData(change).value[typeInfo.location] !== undefined)
            .forEach(change => {
              preDeployReferences[`${getChangeData(change).elemID.getFullName()}.${typeInfo.location}`] =
                change.data.after.value[typeInfo.location]
              change.data.after.value[typeInfo.location] = change.data.after.value[typeInfo.location].filter(
                (value: Value) => !typeInfo.filter(value),
              )
            })
        })
      })
    },

    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      Object.entries(BROKEN_REFERENCE_TYPE_MAP).forEach(([typeName, typeInfos]) => {
        typeInfos.forEach(typeInfo => {
          changes
            .filter(isInstanceChange)
            .filter(isAdditionOrModificationChange)
            .filter(change => getChangeData(change).elemID.typeName === typeName)
            .filter(change => getChangeData(change).value[typeInfo.location] !== undefined)
            .forEach(change => {
              if (
                preDeployReferences[`${getChangeData(change).elemID.getFullName()}.${typeInfo.location}`] !== undefined
              ) {
                change.data.after.value[typeInfo.location] =
                  preDeployReferences[`${getChangeData(change).elemID.getFullName()}.${typeInfo.location}`]
              }
            })
        })
      })
    },
  }
}

export default filter
