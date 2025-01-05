/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { ChangeValidator, getChangeData, isAdditionChange, isInstanceElement } from '@salto-io/adapter-api'
import { entraConstants } from '../../constants'

/*
 * Validates that on-premises groups are not created. Returns an error for each new group with onPremisesSyncEnabled set.
 * The MS Graph API does not support creating on-premises groups, so we block the creation of such groups in advance.
 */
export const onPremGroupAdditionValidator: ChangeValidator = async changes => {
  const onPremGroupAdditions = changes
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === entraConstants.GROUP_TYPE_NAME)
    // If onPremisesSyncEnabled is set to false it means this group was originally synced from an on-premises directory but is no longer synced.
    // We still block the creation of such groups, as the created group will still differ from the original on-premises group.
    .filter(instance => _.get(instance.value, 'onPremisesSyncEnabled') !== undefined)

  return onPremGroupAdditions.map(instance => ({
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Creation of on-premises groups is not supported',
    detailedMessage:
      'Creation of on-premises groups is not supported. Please use the Entra admin center to sync on-premises groups.',
  }))
}
