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
import { Change, ChangeError, ChangeValidator, ElemID, getChangeData, InstanceElement,
  isInstanceChange, isInstanceElement, isModificationChange,
  ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createOrderTypeName, getTypeNameFromOrderTypeName } from '../filters/reorder/creator'
import { getInstanceActivityValue, RELEVANT_TYPE_NAMES } from './instance_has_order'

const { awu } = collections.asynciterable
const log = logger(module)

const RELEVANT_ORDER_TYPE_NAMES = RELEVANT_TYPE_NAMES.map(createOrderTypeName)

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  (RELEVANT_ORDER_TYPE_NAMES.includes(getChangeData(change).elemID.typeName))

export const findAllDuplicates = (names: string[]): string[] => {
  const uniqueNames = new Set(names)
  return _.uniq(names.filter(name => !uniqueNames.delete(name)))
}

const getDuplicationError = ({
  instance, typeName, orderInstanceList, activity,
}: {
  instance: InstanceElement
  typeName: string
  orderInstanceList: string[]
  activity: boolean
}): ChangeError[] => {
  const duplicates = findAllDuplicates(orderInstanceList)
  if (_.isEmpty(duplicates)) {
    return []
  }
  return [{
    elemID: instance.elemID,
    severity: 'Error',
    message: `Some instances were found multiple times in order instance ${instance.elemID.typeName} under the ${activity ? 'active' : 'inactive'} list`,
    detailedMessage: `Order was specified multiple times under the ${activity ? 'active' : 'inactive'} list for the following instances of type ${typeName}: ${duplicates.map(name => ElemID.fromFullName(name).name).join(', ')}. Please make sure to include it in ${instance.elemID.typeName} under the correct list once`,
  }]
}

export const orderInstanceContainsAllTheInstancesValidator: ChangeValidator = async (
  changes, elementSource
) => {
  const relevantOrderInstances = changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(isRelevantChange)
    .map(getChangeData)
  if (_.isEmpty(relevantOrderInstances)) {
    return []
  }
  if (elementSource === undefined) {
    log.error('Failed to run OrderInstanceContainsAllTheInstancesValidator because no element source was provided')
    return []
  }
  const relevantTypeNames = new Set(relevantOrderInstances
    .map(inst => inst.elemID.typeName)
    .map(getTypeNameFromOrderTypeName))
  const orderTypeNameToInstances = await awu(await elementSource.list())
    .filter(id => relevantTypeNames.has(id.typeName))
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .filter(isInstanceElement)
    .groupBy(inst => createOrderTypeName(inst.elemID.typeName))
  return relevantOrderInstances
    .flatMap(orderInstance => {
      const typeName = getTypeNameFromOrderTypeName(orderInstance.elemID.typeName)
      const instances = orderTypeNameToInstances[orderInstance.elemID.typeName]
      const changeErrors: ChangeError[] = []
      const orderInstanceActiveList = orderInstance.value.active
        .map((ref: ReferenceExpression) => ref.elemID.getFullName())
      const orderInstanceInactiveList = orderInstance.value.inactive
        .map((ref: ReferenceExpression) => ref.elemID.getFullName())
      changeErrors.push(...getDuplicationError({
        instance: orderInstance,
        typeName,
        activity: true,
        orderInstanceList: orderInstanceActiveList,
      }))
      changeErrors.push(...getDuplicationError({
        instance: orderInstance,
        typeName,
        activity: false,
        orderInstanceList: orderInstanceInactiveList,
      }))
      const activeList = new Set(orderInstanceActiveList)
      const inactiveList = new Set(orderInstanceInactiveList)
      const instancesNotInCorrectOrderList = instances
        .filter(instance => (getInstanceActivityValue(instance)
          ? !activeList.has(instance.elemID.getFullName())
          : !inactiveList.has(instance.elemID.getFullName())))
      if (!_.isEmpty(instancesNotInCorrectOrderList)) {
        changeErrors.push({
          elemID: orderInstance.elemID,
          severity: 'Error',
          message: `Some instances were not found in order instance ${orderInstance.elemID.typeName}`,
          detailedMessage: `Order not specified for the following instances of type ${typeName}: ${instancesNotInCorrectOrderList.map(instance => instance.elemID.name).join(', ')}. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct list`,
        })
      }
      const instancesInWrongOrderList = instances
        .filter(instance => (getInstanceActivityValue(instance)
          ? inactiveList.has(instance.elemID.getFullName())
          : activeList.has(instance.elemID.getFullName())))
      if (!_.isEmpty(instancesInWrongOrderList)) {
        changeErrors.push({
          elemID: orderInstance.elemID,
          severity: 'Error',
          message: `Some instances were misplaced in order instance ${orderInstance.elemID.typeName}`,
          detailedMessage: `The following instances of type ${typeName} were misplaced: ${instancesInWrongOrderList.map(instance => instance.elemID.name).join(', ')}. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct list`,
        })
      }
      return changeErrors as ChangeError[]
    })
}
