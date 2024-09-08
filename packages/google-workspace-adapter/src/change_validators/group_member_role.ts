/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  InstanceElement,
  ModificationChange,
  getChangeData,
  isInstanceChange,
  isModificationChange,
} from '@salto-io/adapter-api'
import { GROUP_MEMBER_TYPE_NAME } from '../constants'

const isGroupRoleChange = (change: ModificationChange<InstanceElement>): boolean => {
  const { before, after } = change.data
  return before.value.role !== after.value.role && after.value.type !== 'USER'
}

// When a group is a group member of other groups, the role can not be changed and must be 'MEMBER'
export const groupMemberRoleValidator: ChangeValidator = async changes =>
  changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .filter(change => change.data.after.elemID.typeName === GROUP_MEMBER_TYPE_NAME)
    .filter(isGroupRoleChange)
    .map(getChangeData)
    .flatMap(instance => [
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Can not edit group member role for groups',
        detailedMessage: 'Can not edit group member role for groups',
      },
    ])
