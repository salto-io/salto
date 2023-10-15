/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, ReferenceExpression, getChangeData, isAdditionChange, toChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { isPlainObject } from 'lodash'
import { roleType } from '../../src/autogen/types/standard_types/role'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import filterCreator from '../../src/filters/add_permissions_to_cutomRecord'
import { LocalFilterOpts } from '../../src/filter'

const log = logger(module)

describe('add permissions to custom record types filter', () => {
  let customRecord: ObjectType
  let customRecordWithPermissionsField: ObjectType
  let roleWithoutPermission: InstanceElement
  let roleWithIrrelevantPermission: InstanceElement
  let roleWithPermission: InstanceElement
  let otherRoleWithPermission: InstanceElement
  let elementsSource: ReadOnlyElementsSource
  let referenceToCustomRecord: ReferenceExpression
  let referenceToCustomRecordWithPermissions: ReferenceExpression
  let referenceToRoleWithPermission: ReferenceExpression
  let referenceToOtherRoleWithPermission: ReferenceExpression

  beforeEach(() => {
    customRecord = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customRecord'),
      annotations: {
        scriptid: 'custom_record_field',
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    customRecordWithPermissionsField = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customRecordWithPermissions'),
      annotations: {
        scriptid: 'custom_record_with_permissions_field',
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        permissions: {
          permission: {
          },
        },
      },
    })
    roleWithoutPermission = new InstanceElement('role_without_permission', roleType().type, {
      scriptid: 'customrole_withoutPermission',
    })
    roleWithIrrelevantPermission = new InstanceElement('role_with_irrelevant_permission', roleType().type, {
      scriptid: 'customrole_withIrrelevantPermission',
      permissions: {
        permission: {
          TRAN_PAYMENTAUDIT: {
            permkey: 'TRAN_PAYMENTAUDIT',
            permlevel: 'EDIT',
          },
        },
      },
    })

    referenceToCustomRecord = new ReferenceExpression(customRecord.elemID.createNestedID('attr', SCRIPT_ID))
    referenceToCustomRecord.topLevelParent = customRecord

    referenceToCustomRecordWithPermissions = new ReferenceExpression(customRecordWithPermissionsField.elemID.createNestedID('attr', SCRIPT_ID))
    referenceToCustomRecordWithPermissions.topLevelParent = customRecordWithPermissionsField

    roleWithPermission = new InstanceElement('role_with_permission', roleType().type, {
      scriptid: 'customrole_withPermission',
      permissions: {
        permission: {
          customRecord: {
            permkey: referenceToCustomRecord,
            permlevel: 'EDIT',
          },
        },
      },
    })
    otherRoleWithPermission = new InstanceElement('other_role_with_permission', roleType().type, {
      scriptid: 'customrole_otherWithPermission',
      permissions: {
        permission: {
          customRecord: {
            permkey: referenceToCustomRecord,
            permlevel: 'EDIT',
          },
          customRecordWithPermissionsField: {
            permkey: referenceToCustomRecordWithPermissions,
            permlevel: 'EDIT',
          },
        },
      },
    })

    referenceToRoleWithPermission = new ReferenceExpression(roleWithPermission.elemID.createNestedID(SCRIPT_ID))
    referenceToRoleWithPermission.topLevelParent = roleWithPermission

    referenceToOtherRoleWithPermission = new ReferenceExpression(
      otherRoleWithPermission.elemID.createNestedID(SCRIPT_ID)
    )
    referenceToOtherRoleWithPermission.topLevelParent = otherRoleWithPermission

    customRecordWithPermissionsField.annotations.permissions.permission.roleWithPermission = {
      permittedlevel: 'EDIT',
      permittedrole: referenceToRoleWithPermission,
    }
    elementsSource = buildElementsSourceFromElements([
      customRecord,
      customRecordWithPermissionsField,
      roleWithoutPermission,
      roleWithIrrelevantPermission,
      roleWithPermission,
      otherRoleWithPermission,
    ])
  })
  it('should not add custom record to the deployment', async () => {
    const changes = [
      toChange({ before: roleWithoutPermission, after: roleWithPermission }),
      toChange({ after: otherRoleWithPermission }),
    ]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(2)
  })
  it('should not add permissions to custom record if there are no roles in the deployment', async () => {
    const changes = [
      toChange({ after: customRecord }),
      toChange({ after: customRecordWithPermissionsField }),
    ]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(2)
    const permissionsOfChange0 = getChangeData(changes[0]).annotations.permissions?.permission
    expect(permissionsOfChange0 === undefined
      || (isPlainObject(permissionsOfChange0) && Object.keys(permissionsOfChange0).length === 0)).toBeTruthy()
    const permissionsOfChange1 = getChangeData(changes[1]).annotations.permissions?.permission
    expect(isPlainObject(permissionsOfChange1) && Object.keys(permissionsOfChange1).length === 1).toBeTruthy()
  })
  it('should not add permissions to custom record if there are no roles with permission related to the custom record', async () => {
    const changes = [
      toChange({ after: customRecordWithPermissionsField }),
      toChange({ after: roleWithoutPermission }),
      toChange({ after: roleWithIrrelevantPermission }),
      toChange({ after: roleWithPermission }), // the permission in this role is for the other custom record
    ]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(4)
    const permissionsOfChange0 = isAdditionChange(changes[0])
      ? changes[0].data.after?.annotations.permissions?.permission
      : undefined
    expect(isPlainObject(permissionsOfChange0) && Object.keys(permissionsOfChange0).length === 1).toBeTruthy()
  })
  it('should add permissions to custom record if there is a role with permission related to the custom record', async () => {
    const changes = [
      toChange({ after: customRecord }),
      toChange({ after: customRecordWithPermissionsField }),
      toChange({ after: roleWithPermission }),
      toChange({ after: otherRoleWithPermission }),
    ]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(4)

    const permissionsOfChange0 = isAdditionChange(changes[0])
      ? changes[0].data.after?.annotations.permissions?.permission
      : undefined
    expect(isPlainObject(permissionsOfChange0)).toBeTruthy()
    expect(Object.keys(permissionsOfChange0).length).toEqual(2)
    expect(Object.values(permissionsOfChange0)[0]).toEqual({
      permittedlevel: 'EDIT',
      permittedrole: referenceToRoleWithPermission,
    })
    expect(Object.values(permissionsOfChange0)[1]).toEqual({
      permittedlevel: 'EDIT',
      permittedrole: referenceToOtherRoleWithPermission,
    })
    const permissionsOfChange1 = isAdditionChange(changes[1])
      ? changes[1].data.after?.annotations.permissions?.permission
      : undefined
    expect(isPlainObject(permissionsOfChange1)).toBeTruthy()
    expect(Object.keys(permissionsOfChange1).length).toEqual(2)
    expect(Object.values(permissionsOfChange1)[0]).toEqual({
      permittedlevel: 'EDIT',
      permittedrole: referenceToRoleWithPermission,
    })
    expect(Object.values(permissionsOfChange1)[1]).toEqual({
      permittedlevel: 'EDIT',
      permittedrole: referenceToOtherRoleWithPermission,
    })
  })
  log.debug('')
})
