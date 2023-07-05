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
import { collections } from '@salto-io/lowerdash'
import {
  Change,
  ChangeGroupIdFunction,
  getChangeData,
  ChangeGroupId,
  ChangeId,
  isInstanceChange,
  isAdditionChange,
  isReferenceExpression,
  InstanceElement,
  AdditionChange,
} from '@salto-io/adapter-api'
import wu from 'wu'
import { isInstanceOfCustomObjectChange } from './custom_object_instances_deploy'
import { isInstanceOfTypeChange, safeApiName } from './filters/utils'
import {
  ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP, SBAA_APPROVAL_CONDITION,
  SBAA_APPROVAL_RULE,
  SBAA_CONDITIONS_MET,
} from './constants'

const { awu } = collections.asynciterable

const getGroupId = async (change: Change): Promise<string> => {
  if (!isInstanceChange(change) || !(await isInstanceOfCustomObjectChange(change))) {
    return 'salesforce_metadata'
  }
  const typeName = await safeApiName(await getChangeData(change).getType()) ?? 'UNKNOWN'
  return `${change.action}_${typeName}_instances`
}

const getCustomRuleAndConditionChangeIds = async (
  changes: Map<ChangeId, Change>
): Promise<Set<ChangeId>> => {
  const addedInstancesChanges = wu(changes.entries())
    .filter(([_changeId, change]) => isAdditionChange(change))
    .filter(([_changeId, change]) => isInstanceChange(change))
    .toArray() as [ChangeId, AdditionChange<InstanceElement>][]
  const customApprovalRuleAdditions = addedInstancesChanges
    .filter(([_changeId, change]) => isInstanceOfTypeChange(SBAA_APPROVAL_RULE)(change))
    .filter(([_changeId, change]) => getChangeData(change).value[SBAA_CONDITIONS_MET] === 'Custom')
  const customApprovalRuleElemIds = new Set(customApprovalRuleAdditions
    .map(([_changeId, change]) => getChangeData(change).elemID.getFullName()))
  const customApprovalConditionAdditions = await awu(addedInstancesChanges)
    .filter(([_changeId, change]) => isInstanceOfTypeChange(SBAA_APPROVAL_CONDITION)(change))
    .filter(([_changeId, change]) => {
      const approvalRule = getChangeData(change).value[SBAA_APPROVAL_RULE]
      return isReferenceExpression(approvalRule) && customApprovalRuleElemIds.has(approvalRule.elemID.getFullName())
    })
    .toArray()
  return new Set(customApprovalRuleAdditions
    .concat(customApprovalConditionAdditions)
    .map(([changeId]) => changeId))
}

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => {
  const changeGroupIdMap = new Map<ChangeId, ChangeGroupId>()
  const customApprovalRuleAndConditionChangeIds = await getCustomRuleAndConditionChangeIds(changes)
  await awu(changes.entries())
    .filter(async ([changeId]) => !customApprovalRuleAndConditionChangeIds.has(changeId))
    .forEach(async ([changeId, change]) => {
      changeGroupIdMap.set(changeId, await getGroupId(change))
    })
  customApprovalRuleAndConditionChangeIds
    .forEach(changeId => {
      changeGroupIdMap.set(changeId, ADD_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP)
    })

  return { changeGroupIdMap }
}
