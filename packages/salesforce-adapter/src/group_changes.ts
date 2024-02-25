/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  apiNameSync,
  isInstanceOfCustomObjectChangeSync,
  isInstanceOfTypeChangeSync,
} from './filters/utils'
import {
  ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
  SBAA_APPROVAL_CONDITION,
  SBAA_APPROVAL_RULE,
  SBAA_CONDITIONS_MET,
  METADATA_CHANGE_GROUP,
  groupIdForInstanceChangeGroup,
  CPQ_PRICE_RULE,
  CPQ_CONDITIONS_MET,
  CPQ_PRICE_CONDITION,
  ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
  CPQ_PRICE_CONDITION_RULE_FIELD,
} from './constants'

const getGroupId = (change: Change): string => {
  if (
    !isInstanceChange(change) ||
    !isInstanceOfCustomObjectChangeSync(change)
  ) {
    return METADATA_CHANGE_GROUP
  }
  const typeName = apiNameSync(getChangeData(change).getTypeSync()) ?? 'UNKNOWN'
  return groupIdForInstanceChangeGroup(change.action, typeName)
}

/**
 * Returns the changes that should be part of the special deploy group for adding Rule and Condition instances that
 * contain a circular dependency.
 *
 * @ref deployRulesAndConditionsGroup
 */
const getAddCustomRuleAndConditionGroupChangeIds = (
  changes: Map<ChangeId, Change>,
  ruleTypeName: string,
  ruleConditionFieldName: string,
  conditionTypeName: string,
  conditionRuleFieldName: string,
): Set<ChangeId> => {
  const addedInstancesChanges = wu(changes.entries())
    .filter(([_changeId, change]) => isAdditionChange(change))
    .filter(([_changeId, change]) => isInstanceChange(change))
    .toArray() as [ChangeId, AdditionChange<InstanceElement>][]
  const customRuleAdditions = addedInstancesChanges
    .filter(([_changeId, change]) =>
      isInstanceOfTypeChangeSync(ruleTypeName)(change),
    )
    .filter(
      ([_changeId, change]) =>
        getChangeData(change).value[ruleConditionFieldName] === 'Custom',
    )
  const customRuleElemIds = new Set(
    customRuleAdditions.map(([_changeId, change]) =>
      getChangeData(change).elemID.getFullName(),
    ),
  )
  const customConditionAdditions = addedInstancesChanges
    .filter(([_changeId, change]) =>
      isInstanceOfTypeChangeSync(conditionTypeName)(change),
    )
    .filter(([_changeId, change]) => {
      const rule = getChangeData(change).value[conditionRuleFieldName]
      return (
        isReferenceExpression(rule) &&
        customRuleElemIds.has(rule.elemID.getFullName())
      )
    })
  return new Set(
    customRuleAdditions
      .concat(customConditionAdditions)
      .map(([changeId]) => changeId),
  )
}

/**
 * Returns the changes that should be part of the special deploy group for adding sbaa__ApprovalRule
 * instances with sbaa__ConditionsMet = 'Custom' and their corresponding sbaa__ApprovalCondition instances.
 */
const getAddSbaaCustomApprovalRuleAndConditionGroupChangeIds = (
  changes: Map<ChangeId, Change>,
): Set<ChangeId> =>
  getAddCustomRuleAndConditionGroupChangeIds(
    changes,
    SBAA_APPROVAL_RULE,
    SBAA_CONDITIONS_MET,
    SBAA_APPROVAL_CONDITION,
    SBAA_APPROVAL_RULE,
  )

/**
 * Returns the changes that should be part of the special deploy group for adding SBQQ__PriceRule
 * instances with SBQQ__ConditionsMet = 'Custom' and their corresponding SBQQ__PriceCondition instances.
 */
const getAddCpqCustomPriceRuleAndConditionGroupChangeIds = (
  changes: Map<ChangeId, Change>,
): Set<ChangeId> =>
  getAddCustomRuleAndConditionGroupChangeIds(
    changes,
    CPQ_PRICE_RULE,
    CPQ_CONDITIONS_MET,
    CPQ_PRICE_CONDITION,
    CPQ_PRICE_CONDITION_RULE_FIELD,
  )

export const getChangeGroupIds: ChangeGroupIdFunction = async (changes) => {
  const changeGroupIdMap = new Map<ChangeId, ChangeGroupId>()
  const customApprovalRuleAndConditionChangeIds =
    getAddSbaaCustomApprovalRuleAndConditionGroupChangeIds(changes)
  const customPriceRuleAndConditionChangeIds =
    getAddCpqCustomPriceRuleAndConditionGroupChangeIds(changes)
  wu(changes.entries()).forEach(([changeId, change]) => {
    let groupId: string
    if (customApprovalRuleAndConditionChangeIds.has(changeId)) {
      groupId = ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP
    } else if (customPriceRuleAndConditionChangeIds.has(changeId)) {
      groupId = ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP
    } else {
      groupId = getGroupId(change)
    }
    changeGroupIdMap.set(changeId, groupId)
  })

  return { changeGroupIdMap }
}
