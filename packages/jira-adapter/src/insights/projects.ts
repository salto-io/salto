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
import { collections } from '@salto-io/lowerdash'
import {
  ElemID,
  GetInsightsFunc,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { BOARD_TYPE_NAME, PROJECT_CATEGORY_TYPE, PROJECT_COMPONENT_TYPE, PROJECT_TYPE } from '../constants'

const { makeArray } = collections.array

export const isProjectInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === PROJECT_TYPE

const isProjectCategoryInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === PROJECT_CATEGORY_TYPE

const isProjectComponentInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === PROJECT_COMPONENT_TYPE

const isBoardInstance = (instance: InstanceElement): boolean => instance.elemID.typeName === BOARD_TYPE_NAME

const getUnusedProjectCategories = (
  projects: InstanceElement[],
  projectCategories: InstanceElement[],
): InstanceElement[] => {
  const usedProjectCategories = new Set(
    projects
      .map(instance => instance.value.projectCategory)
      .filter(isReferenceExpression)
      .map(ref => ref.elemID.getFullName()),
  )
  return projectCategories.filter(instance => !usedProjectCategories.has(instance.elemID.getFullName()))
}

const getUnusedProjectComponents = (
  projects: InstanceElement[],
  projectComponents: InstanceElement[],
): InstanceElement[] => {
  // I'm not sure about this logic
  const usedProjectComponents = new Set(
    projects
      .flatMap(instance => makeArray(instance.value.components))
      .filter(isReferenceExpression)
      .map(ref => ref.elemID.getFullName()),
  )
  return projectComponents.filter(instance => !usedProjectComponents.has(instance.elemID.getFullName()))
}

const getBoardsPerProject = (boards: InstanceElement[]): [ElemID, number][] =>
  Object.values(
    _.groupBy(
      boards
        .map(instance => instance.value.location?.projectId)
        .filter(isReferenceExpression)
        .map(ref => ref.elemID),
      elemId => elemId.getFullName(),
    ),
  ).map(projectElemIds => [projectElemIds[0], projectElemIds.length])

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement)
  const projects = instances.filter(isProjectInstance)
  const projectCategories = instances.filter(isProjectCategoryInstance)
  const projectComponents = instances.filter(isProjectComponentInstance)
  const boards = instances.filter(isBoardInstance)

  const unusedProjectCategories = getUnusedProjectCategories(projects, projectCategories).map(instance => ({
    path: instance.elemID,
    message: 'Project Category is not used by any project',
  }))

  const unusedProjectComponents = getUnusedProjectComponents(projects, projectComponents).map(instance => ({
    path: instance.elemID,
    message: 'Project Component is not used',
  }))

  const boardsPerProject = getBoardsPerProject(boards).map(([projectElemId, numOfBoards]) => ({
    path: projectElemId,
    message: `Project has ${numOfBoards} boards`,
  }))

  return unusedProjectCategories.concat(unusedProjectComponents).concat(boardsPerProject)
}

export default getInsights
