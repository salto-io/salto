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
  isAdditionChange,
  AdditionChange,
  InstanceElement,
} from '@salto-io/adapter-api'
import { USER_TYPE_NAME } from '../constants'

const isProvisionedUserAdditionChange = (change: AdditionChange<InstanceElement>): boolean =>
  getChangeData(change).elemID.typeName === USER_TYPE_NAME && getChangeData(change).value.status === 'PROVISIONED'

/**
 * When adding a user in PROVISIONED status, the user will be sent an email with either an activation link or a one-time token.
 */
export const provisionedUserAdditions: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .filter(isProvisionedUserAdditionChange)
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Info' as const,
      message: 'User will be emailed to complete the activation process',
      detailedMessage:
        'Salto does not configure authentication for newly added users. The user will receive an email with instructions to complete the activation process.',
    }))
