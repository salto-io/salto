/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { AdjustFunctionSingle } from '../../shared/types'
import { addParentIdToStandaloneFields } from '../../shared/utils'
import { entraConstants } from '../../../../constants'

const { APP_ROLES_FIELD_NAME, IDENTIFIER_URIS_FIELD_NAME, API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME } =
  entraConstants

/*
 * Adjust the Entra application object.
 * 1. Remove the default identifier uri, as it's not deployable between envs.
 * 2. Add the parent id to the app roles.
 */
export const adjustApplication: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, 'application')
  const identifierUris = _.get(value, IDENTIFIER_URIS_FIELD_NAME, [])
  validateArray(identifierUris, IDENTIFIER_URIS_FIELD_NAME)

  const apiField = _.get(value, API_FIELD_NAME)

  return {
    value: {
      ...value,
      identifierUris: _.isEmpty(identifierUris)
        ? undefined
        : identifierUris.filter(uri => uri !== `api://${_.get(value, 'appId')}`),
      [APP_ROLES_FIELD_NAME]: addParentIdToStandaloneFields({ fieldPath: [APP_ROLES_FIELD_NAME], value }),
      ...(apiField && {
        [API_FIELD_NAME]: {
          ...apiField,
          [OAUTH2_PERMISSION_SCOPES_FIELD_NAME]: addParentIdToStandaloneFields({
            fieldPath: [API_FIELD_NAME, OAUTH2_PERMISSION_SCOPES_FIELD_NAME],
            value,
          }),
        },
      }),
    },
  }
}
