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

import { ODATA_TYPE_FIELD, ROLE_DEFINITION_TYPE_NAME } from '../../../src/constants'
import { adjustRoleDefinitionForDeployment } from '../../../src/definitions/deploy/utils'
import { contextMock } from '../../mocks'

describe(`${adjustRoleDefinitionForDeployment.name}`, () => {
  it('should throw an error if the value is not an object', () => {
    const roleDefinition = 'not an object'
    expect(() =>
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).toThrow()
  })

  it('should throw an error if rolePermissions field is not an array', () => {
    const roleDefinition = {
      rolePermissions: 'not an array',
    }
    expect(() =>
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).toThrow()
  })

  it('should not throw an error if rolePermissions field does not exist', () => {
    const roleDefinition = {}
    expect(() =>
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).not.toThrow()
  })

  it('should throw an error if one of the rolePermissions is not an object', () => {
    const roleDefinition = {
      rolePermissions: ['not an object'],
    }
    expect(() =>
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).toThrow()
  })

  it('should return the roleDefinition with the correct format', () => {
    const roleDefinition = {
      rolePermissions: [
        {
          resourceAppId: 'appId',
          resourceType: 'type',
          permission: 'perm',
        },
      ],
    }
    expect(
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).toEqual({
      value: {
        rolePermissions: [
          {
            [ODATA_TYPE_FIELD]: 'microsoft.graph.rolePermission',
            resourceActions: [
              {
                [ODATA_TYPE_FIELD]: 'microsoft.graph.resourceAction',
                resourceAppId: 'appId',
                resourceType: 'type',
                permission: 'perm',
              },
            ],
          },
        ],
      },
    })
  })
})
