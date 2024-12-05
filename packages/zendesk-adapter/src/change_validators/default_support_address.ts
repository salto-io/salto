/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { SUPPORT_ADDRESS_TYPE_NAME } from '../constants'

const createDefaultSupportAddressError = (id: ElemID): ChangeError => ({
  elemID: id,
  severity: 'Error',
  message: "Email: Cannot be a default until it's forwarding is verified",
  detailedMessage: `${id.getFullName()} has default field true and forwarding_status field that is not verified\nIn order to fix this go to the admin center in your zendesk application, search for 'email' and choose 'Email', find the email that is not verified (there should be a red ! under it), click on 'See details' and Verify forwarding`,
})
/*
 * This change validator checks that an Email is not set as default if it's forward status is not verified
 * NOTICE: zendesk doesn't allow the field 'default' to be false, and requires to delete it. This CV doesn't check this issue.
 */
export const defaultSupportAddressValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(change => SUPPORT_ADDRESS_TYPE_NAME === change.elemID.typeName)
    .filter(isInstanceElement)
    .filter(instance => {
      const forwardingValue = instance.value.forwarding_status
      if (!forwardingValue || forwardingValue === 'verified') {
        return false
      }
      return instance.value.default
    })
    .map(instance => createDefaultSupportAddressError(instance.elemID))
