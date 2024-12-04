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
} from '@salto-io/adapter-api'
import _ from 'lodash'

const TYPES_TO_CHECK = new Set(['support_address'])

const createDefaultSupportAddressError = (id: ElemID): ChangeError => ({
  elemID: id,
  severity: 'Error',
  message: "Email: Cannot be a default until it's forwarding is verified",
  detailedMessage: `${id.getFullName()} has default field true and forwarding_status field that is not verified`,
})
/*
 * This change validator checks that an Email is not set as default if it's forward status is not verified
 * NOTICE: zendesk doesn't allow the field 'default' to be false, and requires to delete it. This CV doesn't check this issue.
 */
export const defaultSupportAddressValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(c => TYPES_TO_CHECK.has(c.elemID.typeName))
    .filter(ch => {
      const forwardingValue = _.get(ch, 'value').forwarding_status
      if (!forwardingValue || forwardingValue === 'verified') {
        return false
      }
      const defaultValue = _.get(ch, 'value').default
      if (!defaultValue) {
        return false
      }
      if (defaultValue === true) {
        return true
      }
      return false
    })
    .map(a => createDefaultSupportAddressError(a.elemID))
