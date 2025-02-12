/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

const DELETED_CATEGORY = -1

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
