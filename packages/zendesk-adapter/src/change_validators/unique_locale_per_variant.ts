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
import _ from 'lodash'
import {
  ChangeValidator, getChangeData, InstanceElement, isInstanceElement,
  isAdditionOrModificationChange, isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getParents } from '@salto-io/adapter-utils'
import { VARIANTS_FIELD_NAME, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from '../filters/dynamic_content'
import { isArrayOfRefExprToInstances } from '../filters/utils'

const log = logger(module)

const createEmptyLocaleIdErrorMessage = (): string =>
  'Can’t change an instance with an invalid locale'

const localeIdFromVariant = (variant: InstanceElement): number | undefined =>
  variant.value.locale_id?.value?.value?.id

export const noDuplicateLocaleIdInDynamicContentItemValidator: ChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME)
    .flatMap(instance => {
      const parent = getParents(instance)[0]
      if (!isReferenceExpression(parent)) {
        log.debug(`variant ${instance.elemID.getFullName()} does not have a valid parent, this is caught in another change validator`)
        return []
      }
      const variants = parent.value?.value?.[VARIANTS_FIELD_NAME]
      if (!isArrayOfRefExprToInstances(variants)) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Invalid child variant reference in parent dynamic content',
          detailedMessage: `Parent dynamic content ‘${parent.elemID.getFullName()}’ includes an invalid child variant reference.`,
        }]
      }
      const relevantVariants = variants.map(variant => variant.value).filter(isInstanceElement)
      const localeId = localeIdFromVariant(instance)
      if (localeId === undefined) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: createEmptyLocaleIdErrorMessage(),
          detailedMessage: createEmptyLocaleIdErrorMessage(),
        }]
      }
      const conflictedInstances = relevantVariants
        .filter(variant => {
          const variantLocaleId = localeIdFromVariant(variant)
          return (variantLocaleId !== undefined)
            && variantLocaleId === localeId
            && !variant.elemID.isEqual(instance.elemID)
        })
      if (!_.isEmpty(conflictedInstances)) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Can’t change instance since there are other variants with the same locale',
          detailedMessage: `The following variants have the same locale id: ${conflictedInstances.map(conflictedInstance => conflictedInstance.elemID.getFullName()).join(', ')}`,
        }]
      }
      return []
    })
)
