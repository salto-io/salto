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
import { v4 as uuid4 } from 'uuid'
import _ from 'lodash'
import { APP_ROLES_FIELD_NAME, PARENT_ID_FIELD_NAME } from '../../../constants'
import { AdjustFunctionSingle } from '../types'
import { adjustWrapper } from './read_only_fields'

/*
 * Adjusts the appRoles field in the parent object to:
 * 1. Add an id to each appRole that does not have one
 * 2. Remove the parent_id field from each appRole (we manually add this field during fetch and it is not deployable)
 */
export const adjustParentWithAppRoles: AdjustFunctionSingle = adjustWrapper(async ({ value, typeName }) => {
  validatePlainObject(value, typeName)
  const appRoles = _.get(value, APP_ROLES_FIELD_NAME, [])
  validateArray(appRoles, `${typeName}.${APP_ROLES_FIELD_NAME}`)
  const adjustedAppRoles = appRoles.map(appRole => {
    validatePlainObject(appRole, `${typeName}.${APP_ROLES_FIELD_NAME}`)
    return {
      id: uuid4(),
      ..._.omit(appRole, PARENT_ID_FIELD_NAME),
    }
  })
  return {
    value: {
      ...value,
      ...(_.isEmpty(adjustedAppRoles) ? {} : { [APP_ROLES_FIELD_NAME]: adjustedAppRoles }),
    },
  }
})
