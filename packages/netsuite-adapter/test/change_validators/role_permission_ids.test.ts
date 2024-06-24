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

import { ElemID, InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { NETSUITE, ROLE, SCRIPT_ID } from '../../src/constants'
import { roleType as role } from '../../src/autogen/types/standard_types/role'
import permissionIdsValidator from '../../src/change_validators/role_permission_ids'

describe('role permission ids change validator tests', () => {
  const roleType = role().type

  let roleInstance: InstanceElement

  beforeEach(() => {
    roleInstance = new InstanceElement('testRole', roleType, {
      isinactive: false,
      [SCRIPT_ID]: 'customrole1009',
      name: 'test_role',
      subsidiaryoption: 'ALL',
      permissions: {
        permission: {
          REPO_PERIODENDFINANCIALS: { permkey: 'REPO_PERIODENDFINANCIALS', permlevel: 'VIEW' },
          ADMI_ACCOUNTINGBOOK: { permkey: 'ADMI_ACCOUNTINGBOOK', permlevel: 'FULL' },
        },
      },
    })
  })
  it('should not have change error when deploying a role with valid permissions', async () => {
    const changeErrors = await permissionIdsValidator([toChange({ after: roleInstance })])
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have change error when deploying an undocumented permissions', async () => {
    roleInstance.value.permissions.permission.NEW_PERMISSION = { permkey: 'NEW_PERMISSION', permlevel: 'EDIT' }
    const changeErrors = await permissionIdsValidator([toChange({ after: roleInstance })])
    expect(changeErrors).toHaveLength(0)
  })

  it('should not have change error when the permission is a reference expression', async () => {
    roleInstance.value.permissions.permission.NEW_PERMISSION = {
      permkey: new ReferenceExpression(new ElemID(NETSUITE, ROLE)),
      permlevel: 'FULL',
    }
    const changeErrors = await permissionIdsValidator([toChange({ after: roleInstance })])
    expect(changeErrors).toHaveLength(0)
  })

  it('should have change error when deploying a role with invalid permissions levels', async () => {
    roleInstance.value.permissions.permission.REPO_PERIODENDFINANCIALS.permlevel = 'FULL'
    const changeErrors = await permissionIdsValidator([toChange({ after: roleInstance })])
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].detailedMessage).toEqual(
      'The following permission IDs have invalid permissions, which prevent this role from being deployed: REPO_PERIODENDFINANCIALS. Read more about valid permissions at https://help.salto.io/en/articles/7897170-deploying-elements-with-invalid-permissions.',
    )
    expect(changeErrors[0].elemID).toEqual(roleInstance.elemID)
  })
})
