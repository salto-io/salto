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
  ChangeValidator, getChangeData, InstanceElement,
  isAdditionChange, isAdditionOrModificationChange,
  isInstanceChange, isReferenceExpression, ReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
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

const { findDuplicates } = collections.array

const validateNoDuplicateChild = ({ orderInstances, orderField }: {
  orderInstances: InstanceElement[]
  orderField: string
}): ChangeError[] =>
  orderInstances.filter(order => {
    const children = order.value[orderField].filter(isReferenceExpression)
      .map((child: ReferenceExpression) => child.elemID.getFullName())
    return findDuplicates(children).length !== 0
  }).map(orderInstance => ({
    elemID: orderInstance.elemID,
    severity: 'Warning',
    message: `${orderInstance.elemID.getFullName()} include the same element more than once`,
    detailedMessage: `${orderInstance.elemID.getFullName()} has the same element more than once, order will be determined by the last occurrence of the element`,
  }))

const validateOrderElementAdded = ({ orderInstances, childInstances, orderField, orderTypeName }: {
  orderInstances: InstanceElement[]
  childInstances: InstanceElement[]
  orderField: string
  orderTypeName: string
}): ChangeError[] => {
  const childrenInOrderInstances = new Set(orderInstances
    .flatMap(order => order.value[orderField]).filter(isReferenceExpression)
    .map(child => child.elemID.getFullName()))

  return childInstances.filter(child => !childrenInOrderInstances.has(child.elemID.getFullName()))
    .map(child => notInOrderError({ instance: child, orderTypeName, defaultLocation: 'first' }))
}

const validateChildrenInOrder = ({ changes, orderField, orderTypeName, childTypeName }: {
  changes: readonly Change[]
  orderField: string
  orderTypeName: string
  childTypeName: string
}): ChangeError[] => {
  const relevantOrderInstances = changes.filter(isInstanceChange).filter(isAdditionOrModificationChange)
    .map(getChangeData).filter(order => order.elemID.typeName === orderTypeName)
    .filter(order => validateOrderType(order, orderField))

  const childInstances = changes.filter(isInstanceChange).filter(isAdditionChange)
    .map(getChangeData).filter(child => child.elemID.typeName === childTypeName)

  return [
    validateNoDuplicateChild({ orderInstances: relevantOrderInstances, orderField }),
    validateOrderElementAdded({ orderInstances: relevantOrderInstances, childInstances, orderField, orderTypeName }),
  ].flat()
}

/**
 * Warns the user if he is adding a child instance without adding it to an order instance
 * */
export const childInOrderValidator: ChangeValidator = async changes => [
  validateChildrenInOrder({
    changes,
    orderField: ARTICLES_FIELD,
    orderTypeName: ARTICLE_ORDER_TYPE_NAME,
    childTypeName: ARTICLE_TYPE_NAME,
  }),
  validateChildrenInOrder({
    changes,
    orderField: SECTIONS_FIELD,
    orderTypeName: SECTION_ORDER_TYPE_NAME,
    childTypeName: SECTION_TYPE_NAME,
  }),
  validateChildrenInOrder({
    changes,
    orderField: CATEGORIES_FIELD,
    orderTypeName: CATEGORY_ORDER_TYPE_NAME,
    childTypeName: CATEGORY_TYPE_NAME,
  })].flat()
