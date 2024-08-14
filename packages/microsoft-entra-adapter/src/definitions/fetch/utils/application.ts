/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { addParentIdToAppRoles } from './app_role'
import { APP_ROLES_FIELD_NAME, IDENTIFIER_URIS_FIELD_NAME } from '../../../constants'
import { AdjustFunctionSingle } from '../types'

/*
 * Adjust the application object.
 * 1. Remove the default identifier uri, as it's not deployable between envs.
 * 2. Add the parent id to the app roles.
 */
export const adjustApplication: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, 'application')
  const identifierUris = _.get(value, IDENTIFIER_URIS_FIELD_NAME, [])
  validateArray(identifierUris, IDENTIFIER_URIS_FIELD_NAME)

  return {
    value: {
      ...value,
      identifierUris: identifierUris.filter(uri => uri !== `api://${_.get(value, 'appId')}`),
      [APP_ROLES_FIELD_NAME]: addParentIdToAppRoles(value),
    },
  }
}
