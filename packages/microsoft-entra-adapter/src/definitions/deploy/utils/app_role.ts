/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { APP_ROLES_FIELD_NAME, PARENT_ID_FIELD_NAME } from '../../../constants'
import { AdjustFunctionSingle } from '../types'
import { omitReadOnlyFieldsWrapper } from './read_only_fields'

/*
 * Adjusts the appRoles field in the parent object to:
 * 1. Add an id to each appRole that does not have one
 * 2. Remove the parent_id field from each appRole (we manually add this field during fetch and it is not deployable)
 */
export const adjustParentWithAppRoles: AdjustFunctionSingle = omitReadOnlyFieldsWrapper(async ({ value, typeName }) => {
  validatePlainObject(value, typeName)
  const appRoles = _.get(value, APP_ROLES_FIELD_NAME, [])
  validateArray(appRoles, `${typeName}.${APP_ROLES_FIELD_NAME}`)
  const adjustedAppRoles = appRoles.map(appRole => {
    validatePlainObject(appRole, `${typeName}.${APP_ROLES_FIELD_NAME}`)
    return _.omit(appRole, PARENT_ID_FIELD_NAME)
  })
  return {
    value: {
      ...value,
      ...(_.isEmpty(adjustedAppRoles) ? {} : { [APP_ROLES_FIELD_NAME]: adjustedAppRoles }),
    },
  }
})
