/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import { createOrderTypeName } from '../filters/reorder/creator'
import { ORG_FIELD_TYPE_NAME, QUEUE_TYPE_NAME, TICKET_FORM_TYPE_NAME, USER_FIELD_TYPE_NAME } from '../constants'
import { TYPE_NAME as AUTOMATION_TYPE_NAME } from '../filters/reorder/automation'
import { TYPE_NAME as SLA_POLICY_TYPE_NAME } from '../filters/reorder/sla_policy'
import { TYPE_NAME as VIEW_TYPE_NAME } from '../filters/reorder/view'
import { TYPE_NAME as WORKSPACE_TYPE_NAME } from '../filters/reorder/workspace'

const log = logger(module)

const RELEVANT_TYPE_NAMES = [
  AUTOMATION_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  SLA_POLICY_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  VIEW_TYPE_NAME,
  WORKSPACE_TYPE_NAME,
  QUEUE_TYPE_NAME,
]

const TYPE_NAME_TO_SPECIAL_ACTIVE_FIELD_NAME: Record<string, string> = {
  [WORKSPACE_TYPE_NAME]: 'activated',
}

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  RELEVANT_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)

const isInstanceInOrderList = (orderList: unknown, instance: InstanceElement): boolean =>
  _.isArray(orderList) &&
  orderList.filter(isReferenceExpression).find(ref => ref.elemID.isEqual(instance.elemID)) !== undefined

export const notInOrderError = ({
  instance,
  orderTypeName,
  defaultLocation = 'end',
  messageExtra = '',
}: {
  instance: InstanceElement
  orderTypeName: string
  defaultLocation?: string
  messageExtra?: string
}): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: 'Order not specified',
  detailedMessage: `Element ${instance.elemID.name} of type ${instance.elemID.typeName} is not listed in ${instance.elemID.typeName} sort order.  Therefore, it will be added at the ${defaultLocation} by default.  If the order is important, please include it in ${orderTypeName}${messageExtra}`,
})

export const orderInstanceContainsAllTheInstancesValidator: ChangeValidator = async (changes, elementSource) => {
  const relevantInstances = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(isRelevantChange)
    .map(getChangeData)
  if (_.isEmpty(relevantInstances)) {
    return []
  }
  if (elementSource === undefined) {
    log.error('Failed to run orderInstanceContainsAllTheInstancesValidator because no element source was provided')
    return []
  }
  const relevantOrderTypeNames = _(relevantInstances)
    .map(inst => createOrderTypeName(inst.elemID.typeName))
    .uniq()
    .value()
  const relevantOrderInstances = _.keyBy(
    await getInstancesFromElementSource(elementSource, relevantOrderTypeNames),
    instance => instance.elemID.typeName,
  )
  return relevantInstances.flatMap(instance => {
    const orderTypeName = createOrderTypeName(instance.elemID.typeName)
    // We can assume that we have only one order instances because
    //  we can't add or remove order instances
    const orderInstance = relevantOrderInstances[orderTypeName]
    if (orderInstance === undefined) {
      log.error('Failed to find order instance of instance: %s', instance.elemID.getFullName())
      return []
    }
    const instanceActivityValue =
      instance.value[TYPE_NAME_TO_SPECIAL_ACTIVE_FIELD_NAME[instance.elemID.typeName] ?? 'active']
    const [orderListOfInstanceActivity, orderListOfTheOtherInstanceActivity] = instanceActivityValue
      ? [orderInstance.value.active ?? [], orderInstance.value.inactive ?? []]
      : [orderInstance.value.inactive ?? [], orderInstance.value.active ?? []]
    if (!isInstanceInOrderList(orderListOfInstanceActivity, instance)) {
      return [
        notInOrderError({
          instance,
          orderTypeName,
          messageExtra: ` under the ${instanceActivityValue ? 'active' : 'inactive'} list`,
        }),
      ]
    }
    if (isInstanceInOrderList(orderListOfTheOtherInstanceActivity, instance)) {
      return [
        {
          elemID: instance.elemID,
          severity: 'Warning',
          message: `Element misplaced in ${orderTypeName}`,
          detailedMessage: `Element ${instance.elemID.name} of type ${instance.elemID.typeName} is misplaced in ${orderTypeName}. 
Please make sure to place it under the ${instanceActivityValue ? 'active' : 'inactive'} list`,
        },
      ]
    }
    return []
  })
}
