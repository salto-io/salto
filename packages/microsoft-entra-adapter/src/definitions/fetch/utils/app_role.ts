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

import { Values } from '@salto-io/adapter-api'
import _ from 'lodash'
import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { APP_ROLES_FIELD_NAME } from '../../../constants'

/*
 * Add the parent_id field to the app roles.
 * The id of the app role is only unique within the context of the parent's app roles
 * so we need to add the parent id to the app role object in order to use it for the serviceId.
 */
export const addParentIdToAppRoles = (value: Values): object[] => {
  const appRoles = _.get(value, APP_ROLES_FIELD_NAME, [])
  validateArray(appRoles, APP_ROLES_FIELD_NAME)
  const appRolesWithParentId = appRoles.map((appRole: unknown) => {
    validatePlainObject(appRole, 'app role')
    return {
      parent_id: value.id,
      ...appRole,
    }
  })
  return appRolesWithParentId
}
