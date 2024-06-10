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

import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { GetInsightsFunc, InstanceElement, isInstanceElement, isReferenceToInstance } from '@salto-io/adapter-api'
import { TRIGGER_ORDER_TYPE_NAME } from '../constants'

const { makeArray } = collections.array

const TRIGGER = 'trigger'

const isTriggerOrderInstance = (instance: InstanceElement): boolean =>
  instance.elemID.typeName === TRIGGER_ORDER_TYPE_NAME

const isNotificationTrigger = (instance: InstanceElement): boolean =>
  makeArray(instance.value.actions).find(
    action => _.isString(action.field) && action.field.includes('notification'),
  ) !== undefined

const getMixedOrderNotificationTriggers = (triggersOrder: InstanceElement | undefined): InstanceElement[] => {
  if (triggersOrder === undefined) {
    return []
  }

  const orderedTriggers = makeArray(triggersOrder.value.order)
    // note: taking only active triggers
    .flatMap(triggerCategory => makeArray(triggerCategory.active))
    .filter(isReferenceToInstance)
    .map(ref => ref.value)

  const lastNonNotificationTriggerIndex = _.findLastIndex(orderedTriggers, isNotificationTrigger)
  if (lastNonNotificationTriggerIndex === -1) {
    return []
  }

  return orderedTriggers.slice(0, lastNonNotificationTriggerIndex).filter(isNotificationTrigger)
}

const getInsights: GetInsightsFunc = elements => {
  const triggersOrder = elements.filter(isInstanceElement).find(isTriggerOrderInstance)

  const mixedOrderNotificationTriggers = getMixedOrderNotificationTriggers(triggersOrder).map(instance => ({
    path: instance.elemID,
    ruleId: `${TRIGGER}.mixedOrderNotificationTrigger`,
    message: 'Notification trigger runs before other triggers',
  }))

  return mixedOrderNotificationTriggers
}

export default getInsights
