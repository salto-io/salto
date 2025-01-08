/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { MACRO_TYPE_NAME } from '../constants'
import { ATTACHMENTS_FIELD_NAME } from '../filters/macro_attachments'

const MAX_ATTACHMENTS_IN_MACRO = 5

export const maxAttachmentsInMacroValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === MACRO_TYPE_NAME)
    .flatMap(instance => {
      if ((instance.value[ATTACHMENTS_FIELD_NAME] ?? []).length > MAX_ATTACHMENTS_IN_MACRO) {
        return [
          {
            elemID: instance.elemID,
            severity: 'Error',
            message: 'Cannot make this change since there are too many macro attachments',
            detailedMessage: `Cannot have more than ${MAX_ATTACHMENTS_IN_MACRO} attachments in a single macro`,
          },
        ]
      }
      return []
    })
