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
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
  isRemovalOrModificationChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { getParent, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from '../filters/dynamic_content'
import { DYNAMIC_CONTENT_ITEM_TYPE_NAME } from '../constants'

const { isDefined } = values
const log = logger(module)

const hasResolvedVariantsWithADefault = (variants: ReferenceExpression[]): boolean => {
  const resolvedVariants = variants.filter(isResolvedReferenceExpression)
  if (resolvedVariants.length === 0) {
    return true
  }
  return variants.some((variantRef: ReferenceExpression) => variantRef.value.value.default === true)
}

/**
 * 1. On unsetting or removing a default variant,
 *    make sure there is another default variant for the dynamic content item
 * 2. When adding a new dynamic content item, validate there exists a default variant
 */
export const defaultDynamicContentItemVariantValidator: ChangeValidator = async changes => {
  const dynamicContentItemVariantsChanges = changes
    .filter(isInstanceChange)
    .filter(isRemovalOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME)

  const dynamicContentItemAdditions = changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .filter(change => {
      const changeData = getChangeData(change)
      return (
        changeData.elemID.typeName === DYNAMIC_CONTENT_ITEM_TYPE_NAME &&
        // Filter out items without variants as an array
        changeData.value.variants?.length > 0
      )
    })

  return dynamicContentItemVariantsChanges
    .map((change): ChangeError | undefined => {
      // If the variant wasn't default, it is irrelevant
      if (change.data.before.value.default === false) {
        return undefined
      }

      // If the variant is still or became default, all good
      if (isModificationChange(change) && change.data.after.value.default === true) {
        return undefined
      }

      // A variant became not default, and we need to make sure there is another default variant
      const variant = getChangeData(change)
      try {
        const dynamicContentItem = getParent(variant)
        return hasResolvedVariantsWithADefault(dynamicContentItem.value.variants)
          ? undefined
          : {
              elemID: variant.elemID,
              severity: 'Error',
              message: 'Parent dynamic content item must have a default variant',
              detailedMessage: `If you change the default setting of this variant to false, there will be no other variant set as the default for the dynamic content item '${dynamicContentItem.elemID.name}'. Please ensure that you select another variant of this dynamic content item as the default`,
            }
      } catch (e) {
        log.warn(
          `defaultDynamicContentItemVariantValidator - Failed to get parent of ${variant.elemID.getFullName()}`,
          e,
        )
        return undefined
      }
    })
    .concat(
      dynamicContentItemAdditions.map(change => {
        const dynamicContentItem = getChangeData(change)
        return hasResolvedVariantsWithADefault(dynamicContentItem.value.variants)
          ? undefined
          : {
              elemID: dynamicContentItem.elemID,
              severity: 'Error',
              message: 'Dynamic content item must have a default variant',
              detailedMessage: `The dynamic content item '${dynamicContentItem.elemID.name}' must have a default variant. Please ensure that you select a variant of this dynamic content item as the default`,
            }
      }),
    )
    .filter(isDefined)
}
