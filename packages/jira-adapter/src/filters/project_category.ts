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
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { FilterCreator } from '../filter'
import { PROJECT_TYPE } from '../constants'

export const DELETED_CATEGORY = -1

export const isNeedToDeleteCategory = (change: Change<InstanceElement>): boolean =>
  isModificationChange(change) &&
  change.data.before.value.projectCategory !== undefined &&
  change.data.after.value.projectCategory === undefined

const convertProjectCategoryToCategoryId = async (
  instance: InstanceElement,
  projectKeyToCategory: Record<string, unknown>,
): Promise<void> => {
  if (instance.value.projectCategory === undefined) {
    return
  }
  instance.value.categoryId = isResolvedReferenceExpression(instance.value.projectCategory)
    ? (await instance.value.projectCategory.getResolvedValue()).value.id
    : instance.value.projectCategory
  projectKeyToCategory[instance.value.key] = instance.value.projectCategory
  delete instance.value.projectCategory
}

/**
 * Restructures ProjectCategory to fit the deployment endpoint
 */
const filter: FilterCreator = ({ client }) => {
  const projectKeyToCategory: Record<string, unknown> = {}
  return {
    name: 'projectCategoryFilter',
    preDeploy: async changes => {
      await Promise.all(
        changes
          .filter(isAdditionOrModificationChange)
          .filter(isInstanceChange)
          .filter(change => change.data.after.elemID.typeName === PROJECT_TYPE)
          .map(async change => {
            const instance = getChangeData(change)
            if (isNeedToDeleteCategory(change) && !client.isDataCenter) {
              // Jira DC does not support removing projectCategory from a project
              instance.value.categoryId = DELETED_CATEGORY
            }
            await convertProjectCategoryToCategoryId(instance, projectKeyToCategory)
          }),
      )
    },

    onDeploy: async (changes: Change<Element>[]) => {
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .map(getChangeData)
        .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
        .forEach(instance => {
          if (instance.value.categoryId !== undefined) {
            // if somehow the category not in the Record, we will at least keep the id
            instance.value.projectCategory = projectKeyToCategory[instance.value.key] ?? instance.value.categoryId
            delete instance.value.categoryId
          }
        })
    },
  }
}

export default filter
