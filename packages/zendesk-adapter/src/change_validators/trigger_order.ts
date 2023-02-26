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
import { Change, ChangeError, ChangeValidator, ElemID, getChangeData,
  InstanceElement,
  isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isReferenceExpression,
  ReferenceExpression, Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { createOrderTypeName } from '../filters/reorder/creator'
import { TYPE_NAME as TRIGGER_TYPE_NAME } from '../filters/reorder/trigger'
import { ZENDESK } from '../constants'

const log = logger(module)

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  (getChangeData(change).elemID.typeName === TRIGGER_TYPE_NAME)

export const createWrongPlaceErrorMessage = (
  instanceId: ElemID, orderTypeName: string, active: boolean,
): ChangeError => ({
  elemID: instanceId,
  severity: 'Warning',
  message: `Element misplaced in ${orderTypeName}`,
  detailedMessage: `Element ${instanceId.name} of type ${instanceId.typeName} is misplaced in ${orderTypeName}. Please make sure to place it under the ${active ? 'active' : 'inactive'} list`,
})

export const triggerOrderInstanceContainsAllTheInstancesValidator: ChangeValidator = async (
  changes, elementSource
) => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(isRelevantChange)
    .map(getChangeData)
  if (_.isEmpty(relevantInstances)) {
    return []
  }
  if (elementSource === undefined) {
    log.error('Failed to run triggerOrderInstanceContainsAllTheInstancesValidator because no element source was provided')
    return []
  }
  const triggerOrderTypeName = createOrderTypeName(TRIGGER_TYPE_NAME)
  const orderInstance = await elementSource.get(
    new ElemID(ZENDESK, triggerOrderTypeName, 'instance', ElemID.CONFIG_NAME)
  )
  if (!isInstanceElement(orderInstance)) {
    log.error('Failed to find trigger order instance')
    return []
  }
  return relevantInstances
    .flatMap(instance => {
      const categoryId = instance.value.category_id
      if (!isReferenceExpression(categoryId)) {
        return {
          elemID: instance.elemID,
          severity: 'Error',
          message: `Invalid category id '${categoryId}'`,
          detailedMessage: `Invalid category id '${categoryId}'`,
        }
      }
      const instanceActivityValue = instance.value.active
      const orderEntry = (orderInstance.value.order ?? []).find((entry: Values) =>
        (isReferenceExpression(entry.category) && entry.category.elemID.isEqual(categoryId.elemID)))
      if (
        orderEntry === undefined
        || ((instanceActivityValue ? orderEntry.active : orderEntry.inactive) ?? [])
          .filter(isReferenceExpression)
          .find((ref: ReferenceExpression) => ref.elemID.isEqual(instance.elemID)) === undefined
      ) {
        return [{
          elemID: instance.elemID,
          severity: 'Warning',
          message: 'Order not specified',
          detailedMessage: `Element ${instance.elemID.name} of type ${instance.elemID.typeName} is not listed in the ${instance.elemID.typeName} sort order under the ${categoryId.elemID.name} category.  Therefore, it will be added at the end by default.  
If the order is important, please include it under the ${categoryId.elemID.name} category in the ${instanceActivityValue ? 'active' : 'inactive'} list`,
        }]
      }
      if (((instanceActivityValue ? orderEntry.inactive : orderEntry.active) ?? [])
        .filter(isReferenceExpression)
        .find((ref: ReferenceExpression) => ref.elemID.isEqual(instance.elemID))) {
        return [createWrongPlaceErrorMessage(
          instance.elemID,
          triggerOrderTypeName,
          instanceActivityValue,
        )]
      }
      return orderInstance.value.order
        .filter((entry: Values) => (
          isReferenceExpression(entry.category)
          && !entry.category.elemID.isEqual(categoryId.elemID)
        ))
        .flatMap((entry: Values) => {
          if (
            (entry.active ?? []).concat(entry.inactive ?? [])
              .filter(isReferenceExpression)
              .find((ref: ReferenceExpression) =>
                ref.elemID.isEqual(instance.elemID))
          ) {
            return [createWrongPlaceErrorMessage(
              instance.elemID,
              triggerOrderTypeName,
              instanceActivityValue,
            )]
          }
          return []
        })
    })
}
