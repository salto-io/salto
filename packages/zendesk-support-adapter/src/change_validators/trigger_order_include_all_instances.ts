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
import _ from 'lodash'
import { ChangeError, ChangeValidator, ElemID, getChangeData, InstanceElement, isInstanceChange,
  isInstanceElement, isModificationChange, isReferenceExpression, ReferenceExpression, Values } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createOrderTypeName } from '../filters/reorder/creator'
import { TYPE_NAME as TRIGGER_TYPE_NAME } from '../filters/reorder/trigger'
import { findAllDuplicates } from './order_include_all_instances'

const { awu } = collections.asynciterable
const log = logger(module)

const isRelevantInstance = (instance: InstanceElement): boolean =>
  (instance.elemID.typeName === createOrderTypeName(TRIGGER_TYPE_NAME))

const getInstancesNameFromActivityList = (activityList: unknown): string[] => (
  _.isArray(activityList)
    ? activityList
      .filter(isReferenceExpression)
      .map((ref: ReferenceExpression) => ref.elemID.getFullName())
    : []
)

type ActivityLists = {
  active: Set<string>
  inactive: Set<string>
}

const getDuplicationError = ({
  instance, typeName, orderInstanceList, activity, category,
}: {
  instance: InstanceElement
  typeName: string
  orderInstanceList: string[]
  activity: boolean
  category: InstanceElement
}): ChangeError[] => {
  const duplicates = findAllDuplicates(orderInstanceList)
  if (_.isEmpty(duplicates)) {
    return []
  }
  return [{
    elemID: instance.elemID,
    severity: 'Error',
    message: `Some instances were found multiple times in order instance ${instance.elemID.typeName} under the ${category.elemID.name} category in the ${activity ? 'active' : 'inactive'} list`,
    detailedMessage: `Order was specified multiple times under the ${category.elemID.name} category in the ${activity ? 'active' : 'inactive'} list for the following instances of type ${typeName}: ${duplicates.map(name => ElemID.fromFullName(name).name).join(', ')}. Please make sure to include it in ${instance.elemID.typeName} under the correct list once`,
  }]
}

export const triggerOrderInstanceContainsAllTheInstancesValidator: ChangeValidator = async (
  changes, elementSource
) => {
  const orderInstance = changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .find(isRelevantInstance)
  if (orderInstance === undefined) {
    return []
  }
  if (elementSource === undefined) {
    log.error('Failed to run triggerOrderInstanceContainsAllTheInstancesValidator because no element source was provided')
    return []
  }
  const triggerInstances = await awu(await elementSource.list())
    .filter(id => id.typeName === TRIGGER_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .filter(isInstanceElement)
    .toArray()
  const changeErrors: ChangeError[] = []
  const categoryToActivityLists = _(orderInstance.value.order)
    .filter((entry: Values) =>
      isReferenceExpression(entry.category) && isInstanceElement(entry.category.value))
    .map((entry: Values) => {
      const active = getInstancesNameFromActivityList(entry.active)
      const inactive = getInstancesNameFromActivityList(entry.inactive)
      changeErrors.push(...getDuplicationError({
        instance: orderInstance,
        typeName: TRIGGER_TYPE_NAME,
        activity: true,
        orderInstanceList: active,
        category: entry.category.value,
      }))
      changeErrors.push(...getDuplicationError({
        instance: orderInstance,
        typeName: TRIGGER_TYPE_NAME,
        activity: false,
        orderInstanceList: inactive,
        category: entry.category.value,
      }))
      return [
        entry.category.elemID.getFullName(),
        { active: new Set(active), inactive: new Set(inactive) },
      ]
    })
    .fromPairs()
    .value() as Record<string, ActivityLists>
  const instancesNotInCorrectOrderList = triggerInstances.filter(instance => {
    // If trigger instance has invalid category id, than its not in the correct list
    if (!isReferenceExpression(instance.value.category_id)) {
      return true
    }
    return !categoryToActivityLists[
      (instance.value.category_id as ReferenceExpression).elemID.getFullName()
    ][instance.value.active ? 'active' : 'inactive'].has(instance.elemID.getFullName())
  })
  const instancesInWrongOrderListInSameCategory = triggerInstances.filter(instance => {
    // If trigger instance has invalid category id, than its not in the wrong list
    if (!isReferenceExpression(instance.value.category_id)) {
      return false
    }
    return categoryToActivityLists[
      (instance.value.category_id as ReferenceExpression).elemID.getFullName()
    ][instance.value.active ? 'inactive' : 'active'].has(instance.elemID.getFullName())
  })
  const instancesInWrongCategory = triggerInstances.filter(instance => {
    // If trigger instance has invalid category id, than its not in the wrong list
    if (!isReferenceExpression(instance.value.category_id)) {
      return false
    }
    const instanceFullName = instance.elemID.getFullName()
    return Object.values(
      _.omit(
        categoryToActivityLists,
        (instance.value.category_id as ReferenceExpression).elemID.getFullName(),
      ) as Record<string, ActivityLists>
    ).find((activityLists: ActivityLists) =>
      (activityLists.active.has(instanceFullName)
      || activityLists.inactive.has(instanceFullName)))
  })
  if (!_.isEmpty(instancesNotInCorrectOrderList)) {
    changeErrors.push({
      elemID: orderInstance.elemID,
      severity: 'Error',
      message: `Some instances were not found in order instance ${orderInstance.elemID.typeName} under the correct category`,
      detailedMessage: `Order not specified for the following instances of type ${TRIGGER_TYPE_NAME}: ${instancesNotInCorrectOrderList.map(instance => instance.elemID.name).join(', ')}. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct category in the correct list`,
    })
  }
  if (!_.isEmpty(instancesInWrongOrderListInSameCategory)) {
    changeErrors.push({
      elemID: orderInstance.elemID,
      severity: 'Error',
      message: `Some instances were misplaced in order instance ${orderInstance.elemID.typeName}`,
      detailedMessage: `The following instances of type ${TRIGGER_TYPE_NAME} were misplaced under the correct category: ${instancesInWrongOrderListInSameCategory.map(instance => instance.elemID.name).join(', ')}. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct list`,
    })
  }
  if (!_.isEmpty(instancesInWrongCategory)) {
    changeErrors.push({
      elemID: orderInstance.elemID,
      severity: 'Error',
      message: `Some instances were misplaced in order instance ${orderInstance.elemID.typeName} under the wrong category`,
      detailedMessage: `The following instances of type ${TRIGGER_TYPE_NAME} were misplaced under the wrong category: ${instancesInWrongCategory.map(instance => instance.elemID.name).join(', ')}. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct category in the correct list`,
    })
  }
  return changeErrors
}
