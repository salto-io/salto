/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { PARENT_ID_FIELD_NAME } from '../../../../../src/constants'
import { adjustParentWithAppRolesWrapped } from '../../../../../src/definitions/deploy/entra/utils'
import { contextMock } from '../../../../mocks'

const PARENT_TYPE_NAME = 'parentTypeName'

describe(`${adjustParentWithAppRolesWrapped.name}`, () => {
  it('should throw an error if the value is not an object', async () => {
    const appRolesParent = 'not an object'
    await expect(
      adjustParentWithAppRolesWrapped({
        value: appRolesParent,
        typeName: PARENT_TYPE_NAME,
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should not add an appRoles field if it is not defined', async () => {
    const appRolesParent = {}
    const result = await adjustParentWithAppRolesWrapped({
      value: appRolesParent,
      typeName: PARENT_TYPE_NAME,
      context: contextMock,
    })
    expect(result.value).toEqual(appRolesParent)
  })

  it('should remove the parent_id field from each appRole', async () => {
    const appRolesParent = {
      appRoles: [
        {
          id: 'id1',
          name: 'name1',
          [PARENT_ID_FIELD_NAME]: 'parentId',
        },
        {
          id: 'id2',
          name: 'name2',
        },
      ],
    }
    const result = await adjustParentWithAppRolesWrapped({
      value: appRolesParent,
      typeName: PARENT_TYPE_NAME,
      context: contextMock,
    })
    expect(result.value.appRoles[0][PARENT_ID_FIELD_NAME]).toBeUndefined()
    expect(result.value.appRoles[1][PARENT_ID_FIELD_NAME]).toBeUndefined()
  })
})
