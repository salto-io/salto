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

import { PARENT_ID_FIELD_NAME } from '../../../src/constants'
import { adjustParentWithAppRoles } from '../../../src/definitions/deploy/utils'
import { contextMock } from '../../mocks'

const PARENT_TYPE_NAME = 'parentTypeName'

describe(`${adjustParentWithAppRoles.name}`, () => {
  it('should throw an error if the value is not an object', async () => {
    const appRolesParent = 'not an object'
    await expect(
      adjustParentWithAppRoles({
        value: appRolesParent,
        typeName: PARENT_TYPE_NAME,
        context: contextMock,
      }),
    ).rejects.toThrow()
  })

  it('should not add an appRoles field if it is not defined', async () => {
    const appRolesParent = {}
    const result = await Promise.resolve(
      adjustParentWithAppRoles({
        value: appRolesParent,
        typeName: PARENT_TYPE_NAME,
        context: contextMock,
      }),
    )
    expect(result.value).toEqual(appRolesParent)
  })

  it('should add a uuid to each appRole that does not have an id', async () => {
    const appRolesParent = {
      appRoles: [
        {
          id: 'id1',
          name: 'name1',
        },
        {
          name: 'name2',
        },
      ],
    }
    const result = await Promise.resolve(
      adjustParentWithAppRoles({
        value: appRolesParent,
        typeName: PARENT_TYPE_NAME,
        context: contextMock,
      }),
    )
    expect(result.value.appRoles[1].id).toBeDefined()
    expect(result.value.appRoles[0].id).toBe('id1')
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
    const result = await Promise.resolve(
      adjustParentWithAppRoles({
        value: appRolesParent,
        typeName: PARENT_TYPE_NAME,
        context: contextMock,
      }),
    )
    expect(result.value.appRoles[0][PARENT_ID_FIELD_NAME]).toBeUndefined()
    expect(result.value.appRoles[1][PARENT_ID_FIELD_NAME]).toBeUndefined()
  })
})
