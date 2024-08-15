/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import _ from 'lodash'
import { validateArray, validatePlainObject } from '@salto-io/adapter-utils'
import { ODATA_TYPE_FIELD, ROLE_DEFINITION_TYPE_NAME } from '../../../constants'
import { AdjustFunctionSingle } from '../types'

// For some reason the fetch result doesn't return proper structure according to the docs
// https://learn.microsoft.com/en-us/graph/api/intune-rbac-roledefinition-list?view=graph-rest-1.0&tabs=http
// So we adjust the structure to match the docs
export const adjustRoleDefinitionForDeployment: AdjustFunctionSingle = async ({ value }) => {
  validatePlainObject(value, ROLE_DEFINITION_TYPE_NAME)
  const rolePermissions = _.get(value, 'rolePermissions', [])
  validateArray(rolePermissions, 'rolePermissions')
  return {
    value: {
      ...value,
      rolePermissions: rolePermissions.map(rolePermission => {
        validatePlainObject(rolePermission, 'rolePermission')
        return {
          [ODATA_TYPE_FIELD]: 'microsoft.graph.rolePermission',
          resourceActions: [
            {
              [ODATA_TYPE_FIELD]: 'microsoft.graph.resourceAction',
              ...rolePermission,
            },
          ],
        }
      }),
    },
  }
}
