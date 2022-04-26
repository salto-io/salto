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
import { Change, ChangeValidator, getChangeData, InstanceElement, isInstanceChange,
  isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createOrderTypeName, getTypeNameFromOrderTypeName } from '../filters/reorder/creator'
import { isInstanceInCorrectOrderList, isInstanceInWrongOrderList, RELEVANT_TYPE_NAMES } from './instance_has_order'

const { awu } = collections.asynciterable
const log = logger(module)


const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  (RELEVANT_TYPE_NAMES.map(createOrderTypeName).includes(getChangeData(change).elemID.typeName))

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
  const orderTypeNameToInstances = await awu(await elementSource.list())
    .filter(id =>
      relevantOrderInstances
        .map(inst => inst.elemID.typeName)
        .map(getTypeNameFromOrderTypeName)
        .includes(id.typeName))
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .filter(isInstanceElement)
    .groupBy(inst => createOrderTypeName(inst.elemID.typeName))
  return relevantOrderInstances
    .flatMap(orderInstance => {
      const typeName = getTypeNameFromOrderTypeName(orderInstance.elemID.typeName)
      const instances = orderTypeNameToInstances[orderInstance.elemID.typeName]
      const instancesNotInCorrectOrderList = instances
        .filter(instance => !isInstanceInCorrectOrderList(orderInstance, instance))
      if (instancesNotInCorrectOrderList.length > 0) {
        return [{
          elemID: orderInstance.elemID,
          severity: 'Error',
          message: `Some instances were not found in order instance ${orderInstance.elemID.typeName}`,
          detailedMessage: `Order not specified for the following instances of type ${typeName}: ${instancesNotInCorrectOrderList.map(instance => instance.elemID.name).join(', ')}. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct list`,
        }]
      }
      const instancesInWrongOrderList = instances
        .filter(instance => isInstanceInWrongOrderList(orderInstance, instance))
      if (instancesInWrongOrderList.length > 0) {
        return [{
          elemID: orderInstance.elemID,
          severity: 'Error',
          message: `Some instances were misplaced in order instance ${orderInstance.elemID.typeName}`,
          detailedMessage: `The following instances of type ${typeName} were misplaced: ${instancesInWrongOrderList.map(instance => instance.elemID.name).join(', ')}. Please make sure to include it in ${orderInstance.elemID.typeName} under the correct list`,
        }]
      }
      return []
    })
}
