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
  isInstanceElement, SaltoElementError,
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

const createNonDeployableConditionChangeError = (change: Change): SaltoElementError => ({
  message: `Cannot deploy ApprovalCondition instance ${getChangeData(change).elemID.getFullName()} since it depends on a non-deployable ApprovalRule instance`,
  severity: 'Error',
  elemID: getChangeData(change).elemID,
})

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
  const deployedRuleElemIds = new Set(Object.keys(deployedRuleByElemId))
  log.debug('Deploying ApprovalCondition instances')
  const [deployableConditionChanges, nonDeployableConditionChanges] = _.partition(
    approvalConditionChanges,
    change => deployedRuleElemIds.has(getChangeData(change).value[SBAA_APPROVAL_RULE].elemID.getFullName())
  )
  // Set the ApprovalRule Ids for the ApprovalCondition instances
  // Note that the Errors here are unlikely to happen and will cause weird flows in the deploy.
  // I've added logs for visibility just in case we ever encounter them.
  await awu(deployableConditionChanges)
    .forEach(async change => {
      const instance = getChangeData(change)
      const approvalRule = instance.value[SBAA_APPROVAL_RULE]
      if (!isInstanceElement(approvalRule)) {
        log.error('Expected ApprovalCondition with name %s to contain InstanceElement for the sbaa__ApprovalRule__c field', instance.elemID.getFullName())
        return
      }
      const deployedRule = deployedRuleByElemId[approvalRule.elemID.getFullName()]
      if (deployedRule === undefined) {
        log.error('The ApprovalCondition with name %s is not referencing a successfully deployed ApprovalRule instance with name %s', instance.elemID.getFullName(), approvalRule.elemID.getFullName())
        return
      }
      instance.value[SBAA_APPROVAL_RULE] = await safeApiName(deployedRule)
    })
  const conditionsDeployResult = await deployCustomObjectInstancesGroup(
    deployableConditionChanges,
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
      nonDeployableConditionChanges.map(createNonDeployableConditionChangeError)
    ),
  }
}
