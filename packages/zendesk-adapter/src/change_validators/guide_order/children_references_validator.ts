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
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import {
  ARTICLE_ORDER_TYPE_NAME,
  ARTICLES_FIELD,
  CATEGORIES_FIELD,
  CATEGORY_ORDER_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  SECTIONS_FIELD,
} from '../../constants'
import { validateOrderType } from '../utils'

const createNotReferencesError = (instance: ChangeDataType, orderField: string): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: `${instance.elemID.typeName}'s field '${orderField}' includes an invalid Salto reference`,
  detailedMessage: `${instance.elemID.typeName} instance ${instance.elemID.name}'s field ${orderField} includes one or more invalid Salto references`,
})

const isEverythingReferences = (orderInstance: ChangeDataType, orderField: string): boolean =>
  isInstanceElement(orderInstance) &&
  // If the field doesn't exist we treat it as true
  (orderInstance.value[orderField] === undefined || orderInstance.value[orderField].every(isReferenceExpression))

const validateReferences = ({
  changes,
  orderField,
  orderTypeName,
}: {
  changes: readonly Change[]
  orderField: string
  orderTypeName: string
}): ChangeError[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => orderTypeName === instance.elemID.typeName)
    .filter(instance => validateOrderType(instance, orderField))
    .filter(instance => !isEverythingReferences(instance, orderField))
    .flatMap(instance => [createNotReferencesError(instance, orderField)])

/**
 * Validates that all the elements in the order list are references
 */
export const childrenReferencesValidator: ChangeValidator = async changes =>
  [
    validateReferences({ changes, orderField: ARTICLES_FIELD, orderTypeName: ARTICLE_ORDER_TYPE_NAME }),
    validateReferences({ changes, orderField: SECTIONS_FIELD, orderTypeName: SECTION_ORDER_TYPE_NAME }),
    validateReferences({ changes, orderField: CATEGORIES_FIELD, orderTypeName: CATEGORY_ORDER_TYPE_NAME }),
  ].flat()
