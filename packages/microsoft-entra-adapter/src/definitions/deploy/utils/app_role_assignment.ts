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
                adjust: ({ value, context }) => {
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
