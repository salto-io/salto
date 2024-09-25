/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validatePlainObject } from '@salto-io/adapter-utils'
import { AdjustFunctionSingle } from '../../shared/types'
import { DEVICE_CONFIGURATION_TYPE_NAME } from '../../../../constants/intune'
import { createStaticFileFromBase64Blob } from '../../shared/utils'
import { NAME_ID_FIELD } from '../../shared/defaults'

/**
 * Extracts the payload from the device configuration and creates a static file from it, if exists
 */
export const extractPayloadToStaticFile: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, DEVICE_CONFIGURATION_TYPE_NAME)
  const { payload } = value
  if (!payload) {
    return { value }
  }
  return {
    value: {
      ...value,
      payload: createStaticFileFromBase64Blob({
        typeName: DEVICE_CONFIGURATION_TYPE_NAME,
        fullName: value[NAME_ID_FIELD.fieldName],
        fileName: value.payloadFileName,
        content: payload,
      }),
    },
  }
}
