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
} from '@salto-io/adapter-api'
import { isInstanceOfCustomObjectChange } from './custom_object_instances_deploy'
import { safeApiName } from './filters/utils'
import { ADD_APPROVAL_RULE_AND_CONDITION_GROUP, SBAA_APPROVAL_CONDITION, SBAA_APPROVAL_RULE } from './constants'

const { awu } = collections.asynciterable

const getGroupId = async (change: Change, hasApprovalRuleAndConditionAdditions: boolean): Promise<string> => {
  if (!isInstanceChange(change) || !(await isInstanceOfCustomObjectChange(change))) {
    return 'salesforce_metadata'
  }
  const typeName = await safeApiName(await getChangeData(change).getType()) ?? 'UNKNOWN'
  if (hasApprovalRuleAndConditionAdditions && change.action === 'add' && (typeName === SBAA_APPROVAL_RULE || typeName === SBAA_APPROVAL_CONDITION)) {
    return ADD_APPROVAL_RULE_AND_CONDITION_GROUP
  }
  return `${change.action}_${typeName}_instances`
}

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => {
  const changeGroupIdMap = new Map<ChangeId, ChangeGroupId>()
  const additionTypeNames = new Set(await awu(changes.values())
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(async change => safeApiName(await getChangeData(change).getType()))
    .toArray())
  const hasApprovalRuleAndConditionAdditions = additionTypeNames.has(SBAA_APPROVAL_RULE)
    && additionTypeNames.has(SBAA_APPROVAL_CONDITION)

  await awu(changes.entries()).forEach(async ([changeId, change]) => {
    changeGroupIdMap.set(changeId, await getGroupId(change, hasApprovalRuleAndConditionAdditions))
  })

  return { changeGroupIdMap }
}
