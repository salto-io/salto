/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { entraConstants } from '../../../../constants'
import { AdjustFunctionSingle } from '../../shared/types'

const { CONDITIONAL_ACCESS_POLICY_TYPE_NAME, AUTHENTICATION_STRENGTH_PATH } = entraConstants

/*
 * Retains only the 'id' field in the 'authenticationStrength' object of the given conditional access policy.
 */
export const adjustConditionalAccessPolicy: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, CONDITIONAL_ACCESS_POLICY_TYPE_NAME)
  const authenticationStrength = _.get(value, AUTHENTICATION_STRENGTH_PATH)
  if (!_.isEmpty(authenticationStrength)) {
    _.set(value, AUTHENTICATION_STRENGTH_PATH, _.pick(authenticationStrength, 'id'))
  }
  return { value }
}
