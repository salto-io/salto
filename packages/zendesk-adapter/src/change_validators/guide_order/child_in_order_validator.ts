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
  ChangeError,
  ChangeValidator, getChangeData,
  isAdditionChange, isAdditionOrModificationChange,
  isInstanceChange, isReferenceExpression,
} from '@salto-io/adapter-api'
import {
  ARTICLE_ORDER_TYPE_NAME, ARTICLE_TYPE_NAME,
  ARTICLES_FIELD,
  CATEGORIES_FIELD,
  CATEGORY_ORDER_TYPE_NAME,
  CATEGORY_TYPE_NAME, SECTION_ORDER_TYPE_NAME, SECTION_TYPE_NAME,
  SECTIONS_FIELD,
} from '../../constants'
import { notInOrderError } from '../order'
import { validateOrderType } from '../utils'

const validateOrderElementAdded = ({ changes, orderField, orderTypeName, childTypeName }: {
   changes: readonly Change[]
   orderField: string
   orderTypeName: string
   childTypeName: string
}): ChangeError[] => {
  const relevantChildInstances = changes.filter(isInstanceChange).filter(isAdditionChange)
    .map(getChangeData).filter(child => child.elemID.typeName === childTypeName)

  const relevantOrderInstances = changes.filter(isInstanceChange).filter(isAdditionOrModificationChange)
    .map(getChangeData).filter(order => order.elemID.typeName === orderTypeName)
    .filter(order => validateOrderType(order, orderField))

  const childrenInOrderInstances = new Set(relevantOrderInstances
    .flatMap(order => order.value[orderField]).filter(isReferenceExpression)
    .map(child => child.elemID.getFullName()))

  return relevantChildInstances.filter(child => !childrenInOrderInstances.has(child.elemID.getFullName()))
    .map(child => notInOrderError({ instance: child, orderTypeName, defaultLocation: 'first' }))
}

/**
 * Warns the user if he is adding a child instance without adding it to an order instance
 * */
export const childInOrderValidator: ChangeValidator = async changes => [
  validateOrderElementAdded({
    changes,
    orderField: ARTICLES_FIELD,
    orderTypeName: ARTICLE_ORDER_TYPE_NAME,
    childTypeName: ARTICLE_TYPE_NAME,
  }),
  validateOrderElementAdded({
    changes,
    orderField: SECTIONS_FIELD,
    orderTypeName: SECTION_ORDER_TYPE_NAME,
    childTypeName: SECTION_TYPE_NAME,
  }),
  validateOrderElementAdded({
    changes,
    orderField: CATEGORIES_FIELD,
    orderTypeName: CATEGORY_ORDER_TYPE_NAME,
    childTypeName: CATEGORY_TYPE_NAME,
  })].flat()
