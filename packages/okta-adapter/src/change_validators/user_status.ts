/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  ChangeError,
  isAdditionOrModificationChange,
  isAdditionChange,
  getAllChangeData,
} from '@salto-io/adapter-api'
import { ACTIVE_STATUS, USER_TYPE_NAME } from '../constants'

const ALLOWED_STATUSES_ON_ADDITION = ['STAGED', 'PROVISIONED']
const ALLOWED_STATUSES_ON_ACTIVATION = [ACTIVE_STATUS, 'SUSPENDED', 'LOCKED_OUT']

/**
 * Validate User status on creation and modifications:
 *  - User can only be created with STAGED or PROVISIONED status, as activation requires a user step or setting up password by the admin.
 *  - User can only be modified to status ACTIVE, if its previous status was SUSPENDED or LOCKED_OUT
 *  - When user status is DEPROVISIONED, it can only be modified to PROVISIONED
 */
export const userStatusValidator: ChangeValidator = async changes => {
  const userChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === USER_TYPE_NAME)

  if (_.isEmpty(userChanges)) {
    return []
  }

  const [additionChanges, modificationChanges] = _.partition(userChanges, isAdditionChange)
  const additionChangeErrors = additionChanges
    .filter(change => !ALLOWED_STATUSES_ON_ADDITION.includes(getChangeData(change).value.status))
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error' as ChangeError['severity'],
      message: 'User can only be created with STAGED or PROVISIONED status',
      detailedMessage: 'To deploy this change, please update the status to STAGED or PROVISIONED.',
    }))

  const activationModificationErrors = modificationChanges
    .map(getAllChangeData)
    .filter(
      ([before, after]) =>
        !ALLOWED_STATUSES_ON_ACTIVATION.includes(before.value.status) && after.value.status === ACTIVE_STATUS,
    )
    .map(([, instance]) => ({
      elemID: instance.elemID,
      severity: 'Error' as ChangeError['severity'],
      message: 'User activation is not supported',
      detailedMessage:
        'Activating a user requires either user action or setting a password, which are not supported by Salto. Therefore, users cannot be deployed with an ACTIVE status.',
    }))

  const deprovisionedModificationErrors = modificationChanges
    .map(getAllChangeData)
    .filter(
      ([before, after]) =>
        before.value.status === 'DEPROVISIONED' && !['PROVISIONED', 'DEPROVISIONED'].includes(after.value.status),
    )
    .map(([, instance]) => ({
      elemID: instance.elemID,
      severity: 'Error' as ChangeError['severity'],
      message: 'DEPROVISIONED status can only be changed to PROVISIONED',
      detailedMessage:
        'A user with DEPROVISIONED status can only be changed to PROVISIONED status by reactivating the user.',
    }))

  return additionChangeErrors.concat(activationModificationErrors).concat(deprovisionedModificationErrors)
}
