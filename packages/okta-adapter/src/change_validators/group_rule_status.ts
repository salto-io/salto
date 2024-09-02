/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  InstanceElement,
  ChangeError,
  isModificationChange,
  Change,
  isRemovalChange,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { ACTIVE_STATUS, GROUP_RULE_TYPE_NAME, INACTIVE_STATUS } from '../constants'

const { awu } = collections.asynciterable
const INVALID_STATUS = 'INVALID'

const getGroupRuleStatusError = (change: Change<InstanceElement>): ChangeError | undefined => {
  const instance = getChangeData(change)
  if (isRemovalChange(change) && instance.value.status === ACTIVE_STATUS) {
    return {
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot remove ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}`,
      detailedMessage: `Cannot remove ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}. Please change instance status to ${INACTIVE_STATUS} and try again.`,
    }
  }
  if (isModificationChange(change)) {
    const { before, after } = change.data
    if (before.value.status === INVALID_STATUS) {
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ${INVALID_STATUS}`,
        detailedMessage: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ${INVALID_STATUS}. You can remove this instance and create a new one.`,
      }
    }
    if (before.value.status === ACTIVE_STATUS && after.value.status === ACTIVE_STATUS) {
      // Other changes for the instance while it's in status ACTIVE are not allowed
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}`,
        detailedMessage: `Cannot modify ${GROUP_RULE_TYPE_NAME} with status ${ACTIVE_STATUS}. Please change instance status to ${INACTIVE_STATUS} and try again.`,
      }
    }
  }
  return undefined
}

/**
 * Validate GroupRule status before deployment
 */
export const groupRuleStatusValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(change => getChangeData(change).elemID.typeName === GROUP_RULE_TYPE_NAME)
    .map(getGroupRuleStatusError)
    .filter(values.isDefined)
    .toArray()
