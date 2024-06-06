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

import _ from 'lodash'
import { ROLE_DEFINITION_TYPE_NAME } from '../../../constants'
import { validateArray, validatePlainObject } from '../../type-validators'
import { AdjustFunction } from '../types'

// For some reason the fetch result doesn't return proper structure according to the docs
// https://learn.microsoft.com/en-us/graph/api/intune-rbac-roledefinition-list?view=graph-rest-1.0&tabs=http
// So we adjust the structure to match the docs
export const adjustRoleDefinitionForDeployment: AdjustFunction = ({ value }) => {
  validatePlainObject(value, ROLE_DEFINITION_TYPE_NAME)
  const rolePermissions = _.get(value, 'rolePermissions', [])
  validateArray(rolePermissions, 'rolePermissions')
  return {
    value: {
      ...value,
      rolePermissions: rolePermissions.map(rolePermission => {
        validatePlainObject(rolePermission, 'rolePermission')
        return {
          '@odata.type': 'microsoft.graph.rolePermission',
          resourceActions: [
            {
              '@odata.type': 'microsoft.graph.resourceAction',
              ...rolePermission,
            },
          ],
        }
      }),
    },
  }
}
