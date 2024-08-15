/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { AdjustFunctionSingle } from '../../shared/types'
import { addParentIdToAppRoles } from './app_role'
import { entraConstants } from '../../../../constants'

const { APP_ROLES_FIELD_NAME, IDENTIFIER_URIS_FIELD_NAME } = entraConstants

/*
 * Adjust the Entra application object.
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
