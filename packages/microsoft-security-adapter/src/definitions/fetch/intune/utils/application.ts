/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { isApplicationOfType, isNonSystemApp } from '../../../utils/intune'
import { AdjustFunctionSingle } from '../../shared/types'
import { APPLICATION_TYPE_NAME } from '../../../../constants/entra'
import { APP_STORE_URL_FIELD_NAME, PACKAGE_ID_FIELD_NAME } from '../../../../constants/intune'

/**
 * Omit redundant fields from application based on its type.
 * These omitted fields do not add any value (can be deduced from other fields) and will fail deployment if included.
 */
export const omitApplicationRedundantFields: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, APPLICATION_TYPE_NAME)
  if (isApplicationOfType(value, 'androidManagedStoreApp')) {
    if (!isNonSystemApp(value)) {
      return {
        value: _.omit(value, [PACKAGE_ID_FIELD_NAME, APP_STORE_URL_FIELD_NAME]),
      }
    }
  }
  return { value }
}
