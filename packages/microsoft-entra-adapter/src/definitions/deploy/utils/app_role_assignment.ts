/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { validatePlainObject } from '@salto-io/adapter-utils'
import { EndpointPath } from '../../types'
import { DeployCustomDefinitions } from '../types'

export const createDefinitionForAppRoleAssignment = ({
  parentResourceName,
  typeName,
}: {
  parentResourceName: string
  typeName: string
}): DeployCustomDefinitions => ({
  [typeName]: {
    requestsByAction: {
      customizations: {
        add: [
          {
            request: {
              endpoint: {
                path: `/${parentResourceName}/{parent_id}/appRoleAssignments` as EndpointPath,
                method: 'post',
              },
              transformation: {
                omit: ['id'],
                adjust: async ({ value, context }) => {
                  validatePlainObject(value, typeName)
                  const parentId = _.get(context, 'additionalContext.parent_id')
                  if (!_.isString(parentId)) {
                    throw new Error(
                      `Cannot find principalId for ${typeName}. PrincipalId is required for creating an appRoleAssignment`,
                    )
                  }
                  return {
                    value: {
                      ...value,
                      principalId: parentId,
                    },
                  }
                },
              },
            },
          },
        ],
        remove: [
          {
            request: {
              endpoint: {
                path: `/${parentResourceName}/{parent_id}/appRoleAssignments/{id}` as EndpointPath,
                method: 'delete',
              },
            },
          },
        ],
      },
    },
  },
})
