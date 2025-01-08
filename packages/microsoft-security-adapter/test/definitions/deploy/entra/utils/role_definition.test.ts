/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ODATA_TYPE_FIELD } from '../../../../../src/constants'
import { ROLE_DEFINITION_TYPE_NAME } from '../../../../../src/constants/entra'
import { adjustRoleDefinitionForDeployment } from '../../../../../src/definitions/deploy/entra/utils'
import { contextMock } from '../../../../mocks'

describe(`${adjustRoleDefinitionForDeployment.name}`, () => {
  it('should throw an error if the value is not an object', async () => {
    const roleDefinition = 'not an object'
    await expect(
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should throw an error if rolePermissions field is not an array', async () => {
    const roleDefinition = {
      rolePermissions: 'not an array',
    }
    await expect(
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should not throw an error if rolePermissions field does not exist', async () => {
    const roleDefinition = {}
    await expect(
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).resolves.not.toThrow()
  })

  it('should throw an error if one of the rolePermissions is not an object', async () => {
    const roleDefinition = {
      rolePermissions: ['not an object'],
    }
    await expect(
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should return the roleDefinition with the correct format', async () => {
    const roleDefinition = {
      rolePermissions: [
        {
          resourceAppId: 'appId',
          resourceType: 'type',
          permission: 'perm',
        },
      ],
    }
    await expect(
      adjustRoleDefinitionForDeployment({
        value: roleDefinition,
        typeName: ROLE_DEFINITION_TYPE_NAME,
        context: contextMock,
      }),
    ).resolves.toEqual({
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
