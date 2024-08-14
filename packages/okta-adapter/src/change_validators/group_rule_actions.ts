/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  InstanceElement,
  ChangeError,
  isModificationChange,
  ModificationChange,
  isEqualValues,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { GROUP_RULE_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

const isGroupRuleActionsChange = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  return !isEqualValues(before.value.actions, after.value.actions)
}

/**
 * Verifies GroupRule actions object did not change
 */
export const groupRuleActionsValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_RULE_TYPE_NAME)
    .filter(isGroupRuleActionsChange)
    .map(getChangeData)
    .map(
      (instance: InstanceElement): ChangeError => ({
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot change ${GROUP_RULE_TYPE_NAME} actions`,
        detailedMessage: `Cannot change ${GROUP_RULE_TYPE_NAME} because actions section can not be changed for existing rules.`,
      }),
    )
    .toArray()
