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
import { ChangeValidator, getChangeData, isRemovalChange } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import {
  ORDER_IN_BRAND_TYPE, ORDER_IN_CATEGORY_TYPE,
  ORDER_IN_SECTION_TYPE,
} from '../../filters/guide_order/guide_orders_utils'

const orderTypes = [ORDER_IN_BRAND_TYPE, ORDER_IN_CATEGORY_TYPE, ORDER_IN_SECTION_TYPE]

export const orderDeletionValidator: ChangeValidator = async changes => {
  const removalChanges = changes.filter(isRemovalChange).map(getChangeData)
  const orderRemovals = removalChanges.filter(
    instance => orderTypes.includes(instance.elemID.typeName)
  )

  // Makes sure that if the order list was deleted, the parent was also deleted
  return orderRemovals.filter(orderInstance =>
    !removalChanges.some(instance => instance === getParent(orderInstance)))
    .map(orderInstance => {
      const instanceName = orderInstance.elemID.getFullName()
      const parentName = getParent(orderInstance).elemID.getFullName()
      return {
        elemID: orderInstance.elemID,
        severity: 'Error',
        message: `Error removing ${instanceName}`,
        detailedMessage: `Unable to remove this element without removing it's parent (${parentName})`,
      }
    })
}
