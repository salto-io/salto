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
import { ChangeValidator, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { GUIDE_ORDER_TYPES } from '../../filters/guide_order/guide_order_utils'
import { CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME } from '../../constants'

/**
 * Validates that if an order element was removed, its parent was also removed
 * */
export const orderDeletionValidator: ChangeValidator = async changes => {
  const removalChanges = changes.filter(isRemovalChange).map(getChangeData)
  const orderRemovals = removalChanges.filter(instance =>
    [...GUIDE_ORDER_TYPES, CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME].includes(instance.elemID.typeName),
  )

  const removedElements = new Set(removalChanges.map(change => change.elemID.getFullName()))

  return orderRemovals
    .filter(orderInstance => !removedElements.has(getParent(orderInstance).elemID.getFullName()))
    .map(orderInstance => {
      const instanceName = orderInstance.elemID.name
      const parentName = getParent(orderInstance).elemID.getFullName()
      return {
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: 'Elements order list removed without its parent',
        detailedMessage: `Deleting ${instanceName} requires deleting its parent (${parentName})`,
      }
    })
}
