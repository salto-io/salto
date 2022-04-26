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
import { Change, ChangeValidator, getChangeData, InstanceElement,
  isAdditionOrModificationChange, isInstanceChange, isInstanceElement,
  isReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createOrderTypeName } from '../filters/reorder/creator'
import { TYPE_NAME as AUTOMATION_TYPE_NAME } from '../filters/reorder/automation'
import { TYPE_NAME as ORG_FIELD_TYPE_NAME } from '../filters/reorder/organization_field'
import { TYPE_NAME as SLA_POLICY_TYPE_NAME } from '../filters/reorder/sla_policy'
import { TYPE_NAME as TICKET_FORM_TYPE_NAME } from '../filters/reorder/ticket_form'
import { TYPE_NAME as USER_FIELD_TYPE_NAME } from '../filters/reorder/user_field'
import { TYPE_NAME as VIEW_TYPE_NAME } from '../filters/reorder/view'
import { TYPE_NAME as WORKSPACE_TYPE_NAME } from '../filters/reorder/workspace'

const { awu } = collections.asynciterable
const log = logger(module)

export const RELEVANT_TYPE_NAMES = [
  AUTOMATION_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  SLA_POLICY_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  VIEW_TYPE_NAME,
  WORKSPACE_TYPE_NAME,
]

const TYPE_NAME_TO_SPECIAL_ACTIVE_FIELD_NAME: Record<string, string> = {
  [WORKSPACE_TYPE_NAME]: 'activated',
}

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  (RELEVANT_TYPE_NAMES.includes(getChangeData(change).elemID.typeName))

const getInstanceActivityValue = (instance: InstanceElement): boolean =>
  instance.value[TYPE_NAME_TO_SPECIAL_ACTIVE_FIELD_NAME[instance.elemID.typeName] ?? 'active']

const isInstanceInOrderList = (orderList: unknown, instance: InstanceElement): boolean =>
  _.isArray(orderList)
    && (orderList
      .filter(isReferenceExpression)
      .find(ref => ref.elemID.isEqual(instance.elemID))) !== undefined

export const isInstanceInCorrectOrderList = (
  orderInstance: InstanceElement, instance: InstanceElement
): boolean =>
  isInstanceInOrderList(
    getInstanceActivityValue(instance)
      ? orderInstance.value.active
      : orderInstance.value.inactive,
    instance,
  )

export const isInstanceInWrongOrderList = (
  orderInstance: InstanceElement, instance: InstanceElement
): boolean =>
  isInstanceInOrderList(
    getInstanceActivityValue(instance)
      ? orderInstance.value.inactive
      : orderInstance.value.active,
    instance,
  )

export const instanceHasOrderValidator: ChangeValidator = async (
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
    log.error('Failed to run instanceHasOrderValidator because no element source was provided')
    return []
  }
  const relevantOrderTypeNames = _(relevantInstances)
    .map(inst => createOrderTypeName(inst.elemID.typeName))
    .uniq()
    .value()
  const relevantOrderInstances = await awu(await elementSource.list())
    .filter(id => relevantOrderTypeNames.includes(id.typeName))
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .filter(isInstanceElement)
    .keyBy(inst => inst.elemID.typeName)
  return relevantInstances
    .flatMap(instance => {
      const orderTypeName = createOrderTypeName(instance.elemID.typeName)
      // We can assume that we have only one order instances because
      //  we can't add or remove order instances
      const orderInstance = relevantOrderInstances[orderTypeName]
      if (orderInstance === undefined) {
        log.error('Failed to find order instance of instance: %s', instance.elemID.getFullName())
        return []
      }
      const active = getInstanceActivityValue(instance)
      if (!isInstanceInCorrectOrderList(orderInstance, instance)) {
        return [{
          elemID: instance.elemID,
          severity: 'Warning',
          message: `Instance order not specified in ${orderTypeName}`,
          detailedMessage: `Order not specified for instance ${instance.elemID.name} of type ${instance.elemID.typeName}. Please make sure to include it in ${orderTypeName} under the ${active ? 'active' : 'inactive'} list`,
        }]
      }
      if (isInstanceInWrongOrderList(orderInstance, instance)) {
        return [{
          elemID: instance.elemID,
          severity: 'Warning',
          message: `Instance misplaced in ${orderTypeName}`,
          detailedMessage: `Instance ${instance.elemID.name} of type ${instance.elemID.typeName} is misplaced in ${orderTypeName}. Please make sure to place it under the ${active ? 'active' : 'inactive'} list`,
        }]
      }
      return []
    })
}
