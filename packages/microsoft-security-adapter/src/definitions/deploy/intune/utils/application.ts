/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { inspect } from 'util'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { AdjustFunctionSingle } from '../../shared/types'
import { APP_IDENTIFIER_FIELD_NAME, APPLICATION_TYPE_NAME } from '../../../../constants/intune'
import { isManagedGooglePlayApp } from '../../../../utils/intune'

/**
 * Addition of 'Managed Google Play' apps is done by specifying the productIds field
 * with the desired appId, and ignoring the rest of the fields.
 * The properties of these apps are built-in and cannot be modified, so it's enough to specify their appId.
 */
export const transformManagedGooglePlayApp: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, APPLICATION_TYPE_NAME)
  if (!isManagedGooglePlayApp(value)) {
    throw new Error(`The application is not a managed google play app, received: ${inspect(value)}`)
  }
  const appId = value[APP_IDENTIFIER_FIELD_NAME]
  if (!_.isString(appId)) {
    throw new Error(`Application identifier field is missing or not a string, received: ${inspect(appId)}`)
  }
  return {
    value: { productIds: [`app:${appId}`] },
  }
}
