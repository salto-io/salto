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
import { Change, Element, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isModificationChange, ReferenceExpression } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

const PROJECT_TYPE_NAME = 'Project'
export const DELETED_CATEGORY = -1

const isNeedToDeleteCategory = (change: Change<InstanceElement>): boolean => {
  if (isModificationChange(change)
    && change.data.before.value.projectCategory !== undefined
    && change.data.after.value.projectCategory === undefined) {
    return true
  }
  return false
}

/**
 * Restructures ProjectCategory to fit the deployment endpoint
 */
const filter: FilterCreator = ({ client }) => {
  const projectIdToCategory: Record<string, ReferenceExpression> = {}
  return {
    name: 'projectCategoryFilter',
    preDeploy: async changes => {
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => change.data.after.elemID.typeName === PROJECT_TYPE_NAME)
        .forEach(change => {
          if (isNeedToDeleteCategory(change) && !client.isDataCenter) {
            // Jira DC does not support removing projectCategory from a project
            change.data.after.value.categoryId = DELETED_CATEGORY
          } else if (change.data.after.value.projectCategory !== undefined) {
            change.data.after.value.categoryId = change.data.after.value.projectCategory.resValue.value.id
            projectIdToCategory[change.data.after.value.id] = change.data.after.value.projectCategory
            delete change.data.after.value.projectCategory
          }
        })
    },

    onDeploy: async (changes: Change<Element>[]) => {
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === PROJECT_TYPE_NAME)
        .forEach(instance => {
          if (instance.value.categoryId !== undefined) {
            instance.value.projectCategory = projectIdToCategory[instance.value.id]
            delete instance.value.categoryId
          }
        })
    },
  }
}

export default filter
