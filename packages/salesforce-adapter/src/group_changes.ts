/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
  ChangeDataType,
  RemovalChange,
  isRemovalChange,
} from '@salto-io/adapter-api'
import wu from 'wu'
import { apiNameSync, isInstanceOfCustomObjectChangeSync, isInstanceOfTypeChangeSync } from './filters/utils'
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
  CPQ_ERROR_CONDITION_RULE_FIELD,
  ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP,
  CPQ_PRODUCT_RULE,
  CPQ_ERROR_CONDITION,
  CPQ_QUOTE_TERM,
  CPQ_TERM_CONDITION,
  ADD_CPQ_QUOTE_TERM_AND_CONDITION_GROUP,
  REMOVE_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP,
  REMOVE_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP,
  REMOVE_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP,
  REMOVE_CPQ_QUOTE_TERM_AND_CONDITION_GROUP,
} from './constants'

const getGroupId = (change: Change): string => {
  if (!isInstanceChange(change) || !isInstanceOfCustomObjectChangeSync(change)) {
    return METADATA_CHANGE_GROUP
  }
  const typeName = apiNameSync(getChangeData(change).getTypeSync()) ?? 'UNKNOWN'
  return groupIdForInstanceChangeGroup(change.action, typeName)
}

type GetCustomRuleAndConditionGroupChangeIdsArgs = {
  action: 'add' | 'remove'
  changes: Map<ChangeId, Change>
  ruleTypeName: string
  ruleConditionFieldName: string
  conditionTypeName: string
  conditionRuleFieldName: string
}

type AdditionOrRemovalChange<T extends ChangeDataType> = AdditionChange<T> | RemovalChange<T>

/**
 * Returns the changes that should be part of the special deploy group for adding Rule and Condition instances that
 * contain a circular dependency.
 *
 * @ref deployRulesAndConditionsGroup
 */
const getCustomRuleAndConditionGroupChangeIds = ({
  action,
  changes,
  ruleTypeName,
  ruleConditionFieldName,
  conditionTypeName,
  conditionRuleFieldName,
}: GetCustomRuleAndConditionGroupChangeIdsArgs): Set<ChangeId> => {
  const isMatchingChange = action === 'add' ? isAdditionChange : isRemovalChange
  const instanceChanges = wu(changes.entries())
    .filter(([_changeId, change]) => isMatchingChange(change))
    .filter(([_changeId, change]) => isInstanceChange(change))
    .toArray() as [ChangeId, AdditionOrRemovalChange<InstanceElement>][]
  const customRuleAdditions = instanceChanges
    .filter(([_changeId, change]) => isInstanceOfTypeChangeSync(ruleTypeName)(change))
    .filter(([_changeId, change]) => getChangeData(change).value[ruleConditionFieldName] === 'Custom')
  const customRuleElemIds = new Set(
    customRuleAdditions.map(([_changeId, change]) => getChangeData(change).elemID.getFullName()),
  )
  const customConditionAdditions = instanceChanges
    .filter(([_changeId, change]) => isInstanceOfTypeChangeSync(conditionTypeName)(change))
    .filter(([_changeId, change]) => {
      const rule = getChangeData(change).value[conditionRuleFieldName]
      return isReferenceExpression(rule) && customRuleElemIds.has(rule.elemID.getFullName())
    })
  return new Set(customRuleAdditions.concat(customConditionAdditions).map(([changeId]) => changeId))
}

type GetCustomRulesAndConditionsGroupsChangeIdsFunc = (changes: Map<ChangeId, Change>) => {
  add: Set<ChangeId>
  remove: Set<ChangeId>
}

const getAddSbaaCustomApprovalRuleAndConditionGroupChangeIds: GetCustomRulesAndConditionsGroupsChangeIdsFunc =
  changes => ({
    add: getCustomRuleAndConditionGroupChangeIds({
      action: 'add',
      changes,
      ruleTypeName: SBAA_APPROVAL_RULE,
      ruleConditionFieldName: SBAA_CONDITIONS_MET,
      conditionTypeName: SBAA_APPROVAL_CONDITION,
      conditionRuleFieldName: SBAA_APPROVAL_RULE,
    }),
    remove: getCustomRuleAndConditionGroupChangeIds({
      action: 'remove',
      changes,
      ruleTypeName: SBAA_APPROVAL_RULE,
      ruleConditionFieldName: SBAA_CONDITIONS_MET,
      conditionTypeName: SBAA_APPROVAL_CONDITION,
      conditionRuleFieldName: SBAA_APPROVAL_RULE,
    }),
  })

const getAddCpqCustomPriceRuleAndConditionGroupChangeIds: GetCustomRulesAndConditionsGroupsChangeIdsFunc = changes => ({
  add: getCustomRuleAndConditionGroupChangeIds({
    action: 'add',
    changes,
    ruleTypeName: CPQ_PRICE_RULE,
    ruleConditionFieldName: CPQ_CONDITIONS_MET,
    conditionTypeName: CPQ_PRICE_CONDITION,
    conditionRuleFieldName: CPQ_PRICE_CONDITION_RULE_FIELD,
  }),
  remove: getCustomRuleAndConditionGroupChangeIds({
    action: 'remove',
    changes,
    ruleTypeName: CPQ_PRICE_RULE,
    ruleConditionFieldName: CPQ_CONDITIONS_MET,
    conditionTypeName: CPQ_PRICE_CONDITION,
    conditionRuleFieldName: CPQ_PRICE_CONDITION_RULE_FIELD,
  }),
})

const getAddCpqCustomProductRuleAndConditionGroupChangeIds: GetCustomRulesAndConditionsGroupsChangeIdsFunc =
  changes => ({
    add: getCustomRuleAndConditionGroupChangeIds({
      action: 'add',
      changes,
      ruleTypeName: CPQ_PRODUCT_RULE,
      ruleConditionFieldName: CPQ_CONDITIONS_MET,
      conditionTypeName: CPQ_ERROR_CONDITION,
      conditionRuleFieldName: CPQ_ERROR_CONDITION_RULE_FIELD,
    }),
    remove: getCustomRuleAndConditionGroupChangeIds({
      action: 'remove',
      changes,
      ruleTypeName: CPQ_PRODUCT_RULE,
      ruleConditionFieldName: CPQ_CONDITIONS_MET,
      conditionTypeName: CPQ_ERROR_CONDITION,
      conditionRuleFieldName: CPQ_ERROR_CONDITION_RULE_FIELD,
    }),
  })

const getAddCpqCustomQuoteTermsAndConditionsGroupChangeIds: GetCustomRulesAndConditionsGroupsChangeIdsFunc =
  changes => ({
    add: getCustomRuleAndConditionGroupChangeIds({
      action: 'add',
      changes,
      ruleTypeName: CPQ_QUOTE_TERM,
      ruleConditionFieldName: CPQ_CONDITIONS_MET,
      conditionTypeName: CPQ_TERM_CONDITION,
      conditionRuleFieldName: CPQ_QUOTE_TERM,
    }),
    remove: getCustomRuleAndConditionGroupChangeIds({
      action: 'remove',
      changes,
      ruleTypeName: CPQ_QUOTE_TERM,
      ruleConditionFieldName: CPQ_CONDITIONS_MET,
      conditionTypeName: CPQ_TERM_CONDITION,
      conditionRuleFieldName: CPQ_QUOTE_TERM,
    }),
  })

export const getChangeGroupIds: ChangeGroupIdFunction = async changes => {
  const changeGroupIdMap = new Map<ChangeId, ChangeGroupId>()
  const customApprovalRuleAndConditionChangeIds = getAddSbaaCustomApprovalRuleAndConditionGroupChangeIds(changes)
  const customPriceRuleAndConditionChangeIds = getAddCpqCustomPriceRuleAndConditionGroupChangeIds(changes)
  const customProductRuleAndConditionChangeIds = getAddCpqCustomProductRuleAndConditionGroupChangeIds(changes)
  const customQuoteTermsAndConditionsChangeIds = getAddCpqCustomQuoteTermsAndConditionsGroupChangeIds(changes)

  wu(changes.entries()).forEach(([changeId, change]) => {
    let groupId: string
    if (customApprovalRuleAndConditionChangeIds.add.has(changeId)) {
      groupId = ADD_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP
    } else if (customPriceRuleAndConditionChangeIds.add.has(changeId)) {
      groupId = ADD_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP
    } else if (customProductRuleAndConditionChangeIds.add.has(changeId)) {
      groupId = ADD_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP
    } else if (customQuoteTermsAndConditionsChangeIds.add.has(changeId)) {
      groupId = ADD_CPQ_QUOTE_TERM_AND_CONDITION_GROUP
    } else if (customApprovalRuleAndConditionChangeIds.remove.has(changeId)) {
      groupId = REMOVE_SBAA_CUSTOM_APPROVAL_RULE_AND_CONDITION_GROUP
    } else if (customPriceRuleAndConditionChangeIds.remove.has(changeId)) {
      groupId = REMOVE_CPQ_CUSTOM_PRICE_RULE_AND_CONDITION_GROUP
    } else if (customProductRuleAndConditionChangeIds.remove.has(changeId)) {
      groupId = REMOVE_CPQ_CUSTOM_PRODUCT_RULE_AND_CONDITION_GROUP
    } else if (customQuoteTermsAndConditionsChangeIds.remove.has(changeId)) {
      groupId = REMOVE_CPQ_QUOTE_TERM_AND_CONDITION_GROUP
    } else {
      groupId = getGroupId(change)
    }
    changeGroupIdMap.set(changeId, groupId)
  })

  return { changeGroupIdMap }
}
