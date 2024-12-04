/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
  InstanceElement,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { ACTIVE_STATUS, APPLICATION_TYPE_NAME, APP_GROUP_ASSIGNMENT_TYPE_NAME, INACTIVE_STATUS } from '../constants'

const log = logger(module)

const isParentAppInStatusInactive = (appGroupInstance: InstanceElement): boolean => {
  try {
    const parent = getParent(appGroupInstance)
    return parent.elemID.typeName === APPLICATION_TYPE_NAME && parent.value.status === INACTIVE_STATUS
  } catch {
    log.error(
      'Failed to get parent app, skipping appGroupAssignmentValidator for %s',
      appGroupInstance.elemID.getFullName(),
    )
    return false
  }
}

/**
 * Okta does not support adding to modifying group assignment for applications in status inactive.
 */
export const appGroupAssignmentValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === APP_GROUP_ASSIGNMENT_TYPE_NAME)
    .map(getChangeData)
    .filter(isParentAppInStatusInactive)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot edit group assignments for application in status ${INACTIVE_STATUS}`,
      detailedMessage: `Group assignments cannot be changed for applications in status ${INACTIVE_STATUS}. In order to apply this change, modify application status to be ${ACTIVE_STATUS}.`,
    }))
