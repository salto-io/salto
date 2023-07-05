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
import {
  Change,
  DeployResult,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import SalesforceClient from './client/client'
import { DataManagement } from './fetch_profile/data_management'
import { isInstanceOfTypeChange, safeApiName } from './filters/utils'
import { ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP, SBAA_APPROVAL_RULE, SBAA_CONDITIONS_MET } from './constants'
import { deployCustomObjectInstancesGroup } from './custom_object_instances_deploy'

const { awu } = collections.asynciterable
const log = logger(module)

export const deployAddCustomApprovalRuleAndCondition = async (
  changes: Change<InstanceElement>[],
  client: SalesforceClient,
  dataManagement: DataManagement | undefined
): Promise<DeployResult> => {
  const approvalRuleChanges = await awu(changes)
    .filter(isInstanceOfTypeChange(SBAA_APPROVAL_RULE))
    .toArray()
  const approvalConditionChanges = _.pullAll(changes, approvalRuleChanges)
  log.debug('Deploying ApprovalRule instances without Custom ConditionsMet')
  approvalRuleChanges
    .map(getChangeData)
    .forEach(instance => {
      instance.value[SBAA_CONDITIONS_MET] = 'All'
    })
  const approvalRulesNoCustomDeployResult = await deployCustomObjectInstancesGroup(
    approvalConditionChanges,
    client,
    ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )
  const deployedRuleByElemId = _.keyBy(
    approvalRulesNoCustomDeployResult.appliedChanges.map(getChangeData).filter(isInstanceElement),
    instance => instance.elemID.getFullName()
  )
  log.debug('Deploying ApprovalCondition instances')
  // Set the ApprovalRule Ids for the ApprovalCondition instances
  const deployableApprovalConditionChanges = await awu(approvalConditionChanges)
    .filter(async change => {
      const instance = getChangeData(change)
      const approvalRule = instance.value[SBAA_APPROVAL_RULE]
      if (!isInstanceElement(approvalRule)) {
        return false
      }
      const deployedRule = deployedRuleByElemId[approvalRule.elemID.getFullName()]
      if (deployedRule === undefined) {
        log.error('ApprovalCondition instance with name %s is referencing an ApprovalRule instance with name %s that was not deployed', instance.elemID.name, approvalRule.elemID.name)
        return false
      }
      instance.value[SBAA_APPROVAL_RULE] = await safeApiName(deployedRule)
      return true
    }).toArray()
  const conditionsDeployResult = await deployCustomObjectInstancesGroup(
    deployableApprovalConditionChanges,
    client,
    ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )

  log.debug('Deploying ApprovalRule instances with Custom ConditionsMet')
  const firstDeployAppliedChanges = approvalRulesNoCustomDeployResult.appliedChanges.filter(isInstanceChange)
  firstDeployAppliedChanges
    .map(getChangeData)
    .forEach(instance => {
      instance.value[SBAA_CONDITIONS_MET] = 'Custom'
    })
  const approvalRulesWithCustomDeployResult = await deployCustomObjectInstancesGroup(
    firstDeployAppliedChanges,
    client,
    ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
    dataManagement,
  )

  return {
    appliedChanges: approvalRulesWithCustomDeployResult.appliedChanges
      .concat(conditionsDeployResult.appliedChanges),
    errors: approvalRulesNoCustomDeployResult.errors.concat(
      conditionsDeployResult.errors,
      approvalRulesWithCustomDeployResult.errors,
    ),
  }
}
