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
import { ChangeValidator, CORE_ANNOTATIONS, getChangeData, InstanceElement, isInstanceElement,
  isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { VARIANTS_FIELD_NAME, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from '../filters/dynamic_content'
import { isArrayOfRefExprToInstances } from '../filters/utils'

const createFailedToFindVariantsErrorMessage = (fullName: string): string =>
  `Can not change ${fullName} because we failed to find all the relevant variants`

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
      const variants = instance
        .annotations[CORE_ANNOTATIONS.PARENT]?.[0]?.value?.value?.[VARIANTS_FIELD_NAME]
      if (!isArrayOfRefExprToInstances(variants)) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: createFailedToFindVariantsErrorMessage(instance.elemID.getFullName()),
          detailedMessage: createFailedToFindVariantsErrorMessage(instance.elemID.getFullName()),
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
          message: 'Can’t change instance since there are other variants with the same locale id',
          detailedMessage: `The following variants have the same locale id: ${conflictedInstances.map(conflictedInstance => conflictedInstance.elemID.getFullName()).join(', ')}`,
        }]
      }
      return []
    })
)
