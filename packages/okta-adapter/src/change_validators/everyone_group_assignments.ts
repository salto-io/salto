/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { GROUP_MEMBERSHIP_TYPE_NAME } from '../constants'

/**
 * Assignments to the "Everyone" group are managed by Okta and cannot be modified.
 */
export const everyoneGroupAssignments: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME)
    .filter(instance => instance.elemID.name === 'Everyone')
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Assignment to the "Everyone" group are managed by Okta.',
      detailedMessage:
        'Group assignments to the "Everyone" group are managed by Okta. Any users added in this deployment will be auto assigned to this group.',
    }))
