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
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isInstanceChange, isModificationChange,
  isRemovalOrModificationChange,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'
import { getParent, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from '../filters/dynamic_content'

const { isDefined } = values
const log = logger(module)

/**
 * On unsetting or removing a default variant, make sure there is another default variant for the dynamic content item
 */
export const defaultDynamicContentItemVariantValidator: ChangeValidator = async changes => {
  const dynamicContentItemVariantsChanges = changes.filter(isInstanceChange).filter(isRemovalOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME)

  return dynamicContentItemVariantsChanges.map((change): ChangeError | undefined => {
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
      return dynamicContentItem.value.variants.filter(isResolvedReferenceExpression)
        .some((variantRef: ReferenceExpression) => variantRef.value.value.default === true)
        ? undefined
        : {
          elemID: variant.elemID,
          severity: 'Error',
          message: 'Dynamic content item must have a default variant',
          detailedMessage: 'This variant was set as default, you must set another variant as default before removing this one',
        }
    } catch (e) {
      log.warn(`Failed to get parent of ${variant.elemID.getFullName()}`, e)
      return undefined
    }
  }).filter(isDefined)
}
