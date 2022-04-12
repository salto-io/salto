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
import { Change, ChangeValidator, getChangeData,
  InstanceElement,
  isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createOrderTypeName } from '../filters/reorder/creator'
import { TYPE_NAME as AUTOMATION_TYPE_NAME } from '../filters/reorder/automation'
import { TYPE_NAME as ORG_FIELD_TYPE_NAME } from '../filters/reorder/organization_field'
import { TYPE_NAME as SLA_POLICY_TYPE_NAME } from '../filters/reorder/sla_policy'
import { TYPE_NAME as TICKET_FORM_TYPE_NAME } from '../filters/reorder/ticket_form'
import { TYPE_NAME as TRIGGER_TYPE_NAME } from '../filters/reorder/trigger'
import { TYPE_NAME as USER_FIELD_TYPE_NAME } from '../filters/reorder/user_field'
import { TYPE_NAME as VIEW_TYPE_NAME } from '../filters/reorder/view'
import { TYPE_NAME as WORKSPACE_TYPE_NAME } from '../filters/reorder/workspace'

const { awu } = collections.asynciterable
const log = logger(module)

const RELEVANT_TYPE_NAMES = [
  AUTOMATION_TYPE_NAME,
  ORG_FIELD_TYPE_NAME,
  SLA_POLICY_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  TRIGGER_TYPE_NAME,
  USER_FIELD_TYPE_NAME,
  VIEW_TYPE_NAME,
  WORKSPACE_TYPE_NAME,
]

const TYPE_NAME_TO_SPECIAL_ACTIVE_FIELD_NAME: Record<string, string> = {
  [WORKSPACE_TYPE_NAME]: 'activated',
}

const isRelevantChange = (change: Change<InstanceElement>): boolean =>
  (RELEVANT_TYPE_NAMES.includes(getChangeData(change).elemID.typeName))

export const orderInstanceContainsAllTheInstancesValidator: ChangeValidator = async (
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
    log.error('Failed to run orderInstanceContainsAllTheInstancesValidator because no element source was provided')
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
    .groupBy(inst => inst.elemID.typeName)
  return relevantInstances
    .flatMap(instance => {
      const orderTypeName = createOrderTypeName(instance.elemID.typeName)
      const orderInstances = relevantOrderInstances[orderTypeName]
      if (orderInstances === undefined) {
        log.error(`Order instance ${orderTypeName} must exist`)
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: `Can not change ${instance.elemID.typeName} instance because ${orderTypeName} instance does not exist`,
          detailedMessage: `Can not change ${instance.elemID.getFullName()} because ${orderTypeName} instance does not exist`,
        }]
      }
      if (orderInstances.length !== 1) {
        log.error(`There should be a single ${orderTypeName} instance`)
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: `Can not change ${instance.elemID.typeName} instance because there should be a single ${orderTypeName} instance`,
          detailedMessage: `Can not change ${instance.elemID.getFullName()} because there should be a single ${orderTypeName} instance`,
        }]
      }
      const [orderInstance] = orderInstances
      const instanceActivityValue = instance.value[TYPE_NAME_TO_SPECIAL_ACTIVE_FIELD_NAME[instance.elemID.typeName] ?? 'active']
      const orderListOfInstanceActivity = instanceActivityValue
        ? orderInstance.value.active
        : orderInstance.value.inactive
      const orderListOfTheOtherInstanceActivity = instanceActivityValue
        ? orderInstance.value.inactive
        : orderInstance.value.active
      if (!(
        _.isArray(orderListOfInstanceActivity)
        && orderListOfInstanceActivity
          .filter(isReferenceExpression)
          .find(ref => ref.elemID.isEqual(instance.elemID))
      )) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: `Can not change ${instance.elemID.typeName} instance because it was not found in the ${orderTypeName} instance`,
          detailedMessage: `Can not change ${instance.elemID.getFullName()} because it was not found in the ${orderTypeName} instance`,
        }]
      }
      if (_.isArray(orderListOfTheOtherInstanceActivity)
        && orderListOfTheOtherInstanceActivity
          .filter(isReferenceExpression)
          .find(ref => ref.elemID.isEqual(instance.elemID))) {
        return [{
          elemID: instance.elemID,
          severity: 'Error',
          message: `Can not change ${instance.elemID.typeName} instance because it is apprear in the other activity list of the ${orderTypeName} instance`,
          detailedMessage: `Can not change ${instance.elemID.getFullName()} because it is apprear in the other activity list of the ${orderTypeName} instance`,
        }]
      }
      return []
    })
}
