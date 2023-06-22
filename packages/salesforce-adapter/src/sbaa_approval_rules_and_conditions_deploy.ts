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
import { Change, DeployResult, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import SalesforceClient from './client/client'
import { DataManagement } from './fetch_profile/data_management'
import { isInstanceOfTypeChange } from './filters/utils'
import { ADD_APPROVAL_RULE_AND_CONDITION_GROUP, SBAA_APPROVAL_RULE } from './constants'
import { deployCustomObjectInstancesGroup } from './custom_object_instances_deploy'

const { awu } = collections.asynciterable
const log = logger(module)

export const deployAddApprovalRuleAndCondition = async (
  changes: Change<InstanceElement>[],
  client: SalesforceClient,
  dataManagement: DataManagement | undefined
): Promise<DeployResult> => {
  const approvalRuleChanges = await awu(changes)
    .filter(isInstanceOfTypeChange(SBAA_APPROVAL_RULE))
    .toArray()
  const approvalConditionChanges = _.pullAll(changes, approvalRuleChanges)
  // Replacing the ApprovalRule instances with the resolved instances that will later contain Record Ids.
  const approvalRuleInstancesByElemId = _.keyBy(
    approvalRuleChanges.map(getChangeData),
    instance => instance.elemID.getFullName()
  )
  await awu(approvalConditionChanges)
    .map(getChangeData)
    .forEach(instance => {
      const approvalRule = instance.value[SBAA_APPROVAL_RULE]
      if (isInstanceElement(approvalRule)) {
        instance.value[SBAA_APPROVAL_RULE] = approvalRuleInstancesByElemId[approvalRule.elemID.getFullName()]
      }
    })
  const [rulesWithCustomCondition, rulesWithoutCustomCondition] = _.partition(
    approvalRuleChanges,
    change => getChangeData(change).value.sbaa__ConditionsMet__c === 'Custom'
  )

  const approvalRulesNoCustomDeployResult = await deployCustomObjectInstancesGroup(
    rulesWithoutCustomCondition.concat(await awu(rulesWithCustomCondition)
      .map(change => applyFunctionToChangeData(change, instance => {
        instance.value.sbaa__ConditionsMet__c = 'All'
        return instance
      })).toArray()),
    client,
    ADD_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )
  log.debug('Deploying Approval Condition Instances')
  const conditionsDeployResult = await deployCustomObjectInstancesGroup(
    approvalConditionChanges,
    client,
    ADD_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )
  log.debug('Deploying Approval Rules with Custom ConditionsMet')
  const approvalRulesWithCustomDeployResult = await deployCustomObjectInstancesGroup(
    rulesWithCustomCondition,
    client,
    ADD_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )
  const appliedApprovalRulesWithCustomElemIds = new Set(
    approvalRulesWithCustomDeployResult.appliedChanges.map(change => getChangeData(change).elemID.getFullName())
  )
  return {
    appliedChanges: approvalRulesNoCustomDeployResult.appliedChanges
      // Omit the first-deployment changes of Approval Rules with Custom ConditionsMet
      .filter(change => appliedApprovalRulesWithCustomElemIds.has(getChangeData(change).elemID.getFullName()))
      .concat(conditionsDeployResult.appliedChanges, approvalRulesWithCustomDeployResult.appliedChanges),
    errors: approvalRulesNoCustomDeployResult.errors.concat(
      conditionsDeployResult.errors,
      approvalRulesWithCustomDeployResult.errors,
    ),
  }
}
