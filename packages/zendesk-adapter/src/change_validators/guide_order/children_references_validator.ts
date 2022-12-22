/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ChangeError,
  ChangeValidator, getChangeData,
  isAdditionOrModificationChange, isInstanceElement, isReferenceExpression,
} from '@salto-io/adapter-api'
import {
  ARTICLE_ORDER_TYPE_NAME,
  ARTICLES_FIELD,
  CATEGORIES_FIELD, CATEGORY_ORDER_TYPE_NAME, SECTION_ORDER_TYPE_NAME,
  SECTIONS_FIELD,
} from '../../constants'


const createNotReferencesError = (instance: ChangeDataType, orderField: string)
    : ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Guide elements order list includes an invalid Salto reference',
  detailedMessage: `One or more elements in ${instance.elemID.getFullName()}'s ${orderField} field are not a valid Salto reference`,
})

const isEverythingReferences = (orderInstance: ChangeDataType, orderField: string)
    : boolean =>
  isInstanceElement(orderInstance)
    // If the field doesn't exist we treat it as true
    && (orderInstance.value[orderField] === undefined
        || orderInstance.value[orderField].every(isReferenceExpression))


const validateReferences = (
  changes: readonly Change[],
  orderField: string,
  orderTypeName: string
): ChangeError[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => orderTypeName === instance.elemID.typeName)
    .filter(instance => !isEverythingReferences(instance, orderField))
    .flatMap(instance => [createNotReferencesError(instance, orderField)])


/**
 * Validates that all the elements in the order list are references
 */
export const childrenReferencesValidator: ChangeValidator = async changes => {
  const errors: ChangeError[] = []
  return errors.concat(
    validateReferences(changes, ARTICLES_FIELD, ARTICLE_ORDER_TYPE_NAME),
    validateReferences(changes, SECTIONS_FIELD, SECTION_ORDER_TYPE_NAME),
    validateReferences(changes, CATEGORIES_FIELD, CATEGORY_ORDER_TYPE_NAME)
  )
}
