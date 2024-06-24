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
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  ARTICLE_ORDER_TYPE_NAME,
  ARTICLE_TYPE_NAME,
  ARTICLES_FIELD,
  CATEGORIES_FIELD,
  CATEGORY_ORDER_TYPE_NAME,
  CATEGORY_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  SECTIONS_FIELD,
} from '../../constants'
import { validateOrderType } from '../utils'

const { isDefined } = lowerDashValues
const log = logger(module)

const getChildParent = (child: InstanceElement): ReferenceExpression => {
  switch (child.elemID.typeName) {
    case ARTICLE_TYPE_NAME:
      return child.value.section_id
    case CATEGORY_TYPE_NAME:
      return child.value.brand
    default:
      return child.value.parent_section_id ?? child.value.category_id
  }
}

const createNotSameParentError = ({
  orderInstance,
  wrongParentChildren,
}: {
  orderInstance: InstanceElement
  wrongParentChildren: InstanceElement[]
}): ChangeError => ({
  elemID: orderInstance.elemID,
  severity: 'Error',
  message: 'Guide elements order list includes instances that are not of the same parent',
  detailedMessage: `${wrongParentChildren.map(child => child.elemID.getFullName()).join(', ')} are not of the same ${getParent(orderInstance).elemID.typeName} as ${orderInstance.elemID.name}`,
})

const orderChildrenDifferentParent = (
  orderInstance: InstanceElement,
  children: InstanceElement[],
): { orderInstance: InstanceElement; wrongParentChildren: InstanceElement[] } | undefined => {
  try {
    const orderParent = getParent(orderInstance).elemID.getFullName()
    const wrongParentChildren = children
      .filter(isInstanceElement)
      .filter(child => orderParent !== getChildParent(child)?.value.elemID.getFullName())
    return wrongParentChildren.length > 0 ? { orderInstance, wrongParentChildren } : undefined
  } catch (e) {
    log.error(`${orderInstance.elemID.getFullName()} does not have parent annotation`)
    return undefined
  }
}

const validateOrdersChildrenSameParent = ({
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
    .filter(change => change.elemID.typeName === orderTypeName)
    .filter(order => validateOrderType(order, orderField))
    .map(order =>
      orderChildrenDifferentParent(
        order,
        order.value[orderField].map((c: ReferenceExpression) => c.value),
      ),
    )
    .filter(isDefined)
    .map(createNotSameParentError)

/**
 * Validates that all children in an order instance have the same parent as the order
 */
export const orderChildrenParentValidator: ChangeValidator = async changes =>
  [
    validateOrdersChildrenSameParent({ changes, orderField: ARTICLES_FIELD, orderTypeName: ARTICLE_ORDER_TYPE_NAME }),
    validateOrdersChildrenSameParent({ changes, orderField: SECTIONS_FIELD, orderTypeName: SECTION_ORDER_TYPE_NAME }),
    validateOrdersChildrenSameParent({
      changes,
      orderField: CATEGORIES_FIELD,
      orderTypeName: CATEGORY_ORDER_TYPE_NAME,
    }),
  ].flat()
