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

import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
  getChangeData,
  isAdditionChange,
  isInstanceChange,
  isModificationChange,
  isObjectTypeChange,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { isPlainObject } from 'lodash'
import { roleType } from '../../src/autogen/types/standard_types/role'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import filterCreator from '../../src/filters/add_permissions_to_cutomRecord_and_roles'
import { LocalFilterOpts } from '../../src/filter'

describe('add permissions to custom record types filter', () => {
  let customRecord1: ObjectType
  let customRecord2: ObjectType

  let role1: InstanceElement
  let role2: InstanceElement

  let elementsSource: ReadOnlyElementsSource

  const customRecord1Object = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord_1'),
    annotations: {
      scriptid: 'customrecord_1',
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      permissions: {
        permission: {
          system_role: {
            permittedlevel: 'VIEW',
            permittedrole: 'ACCOUNTANT',
          },
          customrole_1: {
            permittedlevel: 'VIEW',
            permittedrole: 'temp',
            restriction: 'VIEWANDEDIT',
          },
          customrole_2: {
            permittedlevel: 'CREATE',
            permittedrole: 'temp',
            restriction: 'EDIT',
          },
        },
      },
    },
  })

  const customRecord2Object = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord_2'),
    annotations: {
      scriptid: 'customrecord_2',
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      permissions: {
        permission: {
          system_role: {
            permittedlevel: 'VIEW',
            permittedrole: 'ACCOUNTANT',
          },
          customrole_1: {
            permittedlevel: 'VIEW',
            permittedrole: 'temp',
            restriction: 'VIEWANDEDIT',
          },
          customrole_2: {
            permittedlevel: 'CREATE',
            permittedrole: 'temp',
            restriction: 'EDIT',
          },
        },
      },
    },
  })

  const role1Instance = new InstanceElement('customrole_1', roleType().type, {
    scriptid: 'customrole_1',
    permissions: {
      permission: {
        system_record: {
          permkey: 'TRAN_PAYMENTAUDIT',
          permlevel: 'EDIT',
        },
        customrecord_1: {
          permkey: 'temp',
          permlevel: 'VIEW',
          restriction: 'VIEWANDEDIT',
        },
        customrecord_2: {
          permkey: 'temp',
          permlevel: 'VIEW',
          restriction: 'VIEWANDEDIT',
        },
      },
    },
  })

  const role2Instance = new InstanceElement('customrole_2', roleType().type, {
    scriptid: 'customrole_2',
    permissions: {
      permission: {
        system_record: {
          permkey: 'TRAN_PAYMENTAUDIT',
          permlevel: 'EDIT',
        },
        customrecord_1: {
          permkey: 'temp',
          permlevel: 'CREATE',
          restriction: 'EDIT',
        },
        customrecord_2: {
          permkey: 'temp',
          permlevel: 'CREATE',
          restriction: 'EDIT',
        },
      },
    },
  })

  // customRecord1Object
  customRecord1Object.annotations.permissions.permission.customrole_1.permittedrole = new ReferenceExpression(
    role1Instance.elemID.createNestedID(SCRIPT_ID),
    role1Instance.value[SCRIPT_ID],
    role1Instance,
  )
  customRecord1Object.annotations.permissions.permission.customrole_2.permittedrole = new ReferenceExpression(
    role2Instance.elemID.createNestedID(SCRIPT_ID),
    role2Instance.value[SCRIPT_ID],
    role2Instance,
  )

  // customRecord2Object
  customRecord2Object.annotations.permissions.permission.customrole_1.permittedrole = new ReferenceExpression(
    role1Instance.elemID.createNestedID(SCRIPT_ID),
    role1Instance.value[SCRIPT_ID],
    role1Instance,
  )
  customRecord2Object.annotations.permissions.permission.customrole_2.permittedrole = new ReferenceExpression(
    role2Instance.elemID.createNestedID(SCRIPT_ID),
    role2Instance.value[SCRIPT_ID],
    role2Instance,
  )

  // role1Instance
  role1Instance.value.permissions.permission.customrecord_1.permkey = new ReferenceExpression(
    customRecord1Object.elemID.createNestedID('attr', SCRIPT_ID),
    customRecord1Object.annotations[SCRIPT_ID],
    customRecord1Object,
  )
  role1Instance.value.permissions.permission.customrecord_2.permkey = new ReferenceExpression(
    customRecord2Object.elemID.createNestedID('attr', SCRIPT_ID),
    customRecord2Object.annotations[SCRIPT_ID],
    customRecord2Object,
  )

  // role2Instance
  role2Instance.value.permissions.permission.customrecord_1.permkey = new ReferenceExpression(
    customRecord1Object.elemID.createNestedID('attr', SCRIPT_ID),
    customRecord1Object.annotations[SCRIPT_ID],
    customRecord1Object,
  )
  role2Instance.value.permissions.permission.customrecord_2.permkey = new ReferenceExpression(
    customRecord2Object.elemID.createNestedID('attr', SCRIPT_ID),
    customRecord2Object.annotations[SCRIPT_ID],
    customRecord2Object,
  )

  beforeEach(() => {
    role1 = role1Instance.clone()
    role2 = role2Instance.clone()
    customRecord1 = customRecord1Object.clone()
    customRecord2 = customRecord2Object.clone()
    elementsSource = buildElementsSourceFromElements([customRecord1, customRecord2, role1, role2])
  })
  describe('should not add new changes', () => {
    it('should not add custom record to the deployment', async () => {
      const roleWithoutPermission = role1.clone()
      delete roleWithoutPermission.value.permissions.permission
      const changes = [toChange({ before: roleWithoutPermission, after: role1 }), toChange({ after: role2 })]
      await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
      expect(changes.length).toEqual(2)
    })
    it('should not add roles to the deployment', async () => {
      const customRecordWithoutPermission = customRecord1.clone()
      delete customRecordWithoutPermission.annotations.permissions.permission
      const changes = [
        toChange({ before: customRecordWithoutPermission, after: customRecord1 }),
        toChange({ after: customRecord2 }),
      ]
      await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
      expect(changes.length).toEqual(2)
    })
    it('should not add roles and custom records to the deployment', async () => {
      const customRecordWithoutPermission = customRecord1.clone()
      delete customRecordWithoutPermission.annotations.permissions.permission
      const changes = [
        toChange({ before: customRecordWithoutPermission, after: customRecord1 }),
        toChange({ after: role1 }),
      ]
      await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
      expect(changes.length).toEqual(2)
    })
  })
  it('should not add permissions to custom record if there are no roles in the deployment', async () => {
    const customRecordWithoutPermission = customRecord1.clone()
    delete customRecordWithoutPermission.annotations.permissions.permission
    const changes = [toChange({ after: customRecordWithoutPermission }), toChange({ after: customRecord2 })]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(2)
    const permissionsOfChange0 = getChangeData(changes[0]).annotations.permissions?.permission
    expect(
      permissionsOfChange0 === undefined ||
        (isPlainObject(permissionsOfChange0) && Object.keys(permissionsOfChange0).length === 0),
    ).toBeTruthy()
    const permissionsOfChange1 = getChangeData(changes[1]).annotations.permissions?.permission
    expect(isPlainObject(permissionsOfChange1) && Object.keys(permissionsOfChange1).length === 3).toBeTruthy()
  })
  it('should not add permissions to role if there are no custom records in the deployment', async () => {
    const roledWithoutPermission = role1.clone()
    delete roledWithoutPermission.value.permissions.permission
    const changes = [toChange({ after: roledWithoutPermission }), toChange({ after: role2 })]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(2)
    const permissionsOfChange0 = getChangeData(changes[0]).value.permissions?.permission
    expect(
      permissionsOfChange0 === undefined ||
        (isPlainObject(permissionsOfChange0) && Object.keys(permissionsOfChange0).length === 0),
    ).toBeTruthy()
    const permissionsOfChange1 = getChangeData(changes[1]).value.permissions?.permission
    expect(isPlainObject(permissionsOfChange1) && Object.keys(permissionsOfChange1).length === 3).toBeTruthy()
  })
  it('should not add permissions if there are no missing ones', async () => {
    const customRecordWithoutRole1Permission = customRecord1.clone()
    delete customRecordWithoutRole1Permission.annotations.permissions.permission.customrole_1

    const roleWithoutCustomRecord1Permission = role1.clone()
    delete roleWithoutCustomRecord1Permission.value.permissions.permission.customrecord_1

    const changes = [
      toChange({ after: customRecordWithoutRole1Permission }),
      toChange({ after: roleWithoutCustomRecord1Permission }),
    ]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(2)
    const permissionsOfChange0 = isAdditionChange(changes[0])
      ? changes[0].data.after.annotations.permissions?.permission
      : undefined
    expect(
      permissionsOfChange0 === undefined ||
        (isPlainObject(permissionsOfChange0) && Object.keys(permissionsOfChange0).length === 2),
    ).toBeTruthy()
    const permissionsOfChange1 =
      isAdditionChange(changes[1]) && isInstanceChange(changes[1])
        ? changes[1].data.after.value.permissions?.permission
        : undefined
    expect(isPlainObject(permissionsOfChange1) && Object.keys(permissionsOfChange1).length === 2).toBeTruthy()
  })
  it('should add permissions to custom-record/role if there is a role/custom-record with permission related to it', async () => {
    // without permission field
    const roleWithoutPermissions = role1.clone()
    delete roleWithoutPermissions.value.permissions.permission

    // without 1 permission
    const roleWithoutAPermission = role2.clone()
    delete roleWithoutAPermission.value.permissions.permission.customrecord_2

    // with empty permission field
    const customRecordWithoutPermissions = customRecord1.clone()
    delete customRecordWithoutPermissions.annotations.permissions.permission.customrole_1
    delete customRecordWithoutPermissions.annotations.permissions.permission.customrole_2
    delete customRecordWithoutPermissions.annotations.permissions.permission.system_role

    const changes = [
      toChange({ after: roleWithoutPermissions }),
      toChange({ after: roleWithoutAPermission }),
      toChange({ after: customRecordWithoutPermissions }),
      toChange({ after: customRecord2 }),
    ]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(4)

    const permissionsOfChange0 =
      isAdditionChange(changes[0]) && isInstanceChange(changes[0])
        ? changes[0].data.after.value.permissions.permission
        : undefined
    expect(isPlainObject(permissionsOfChange0)).toBeTruthy()
    expect(Object.keys(permissionsOfChange0).length).toEqual(1)
    expect(Object.values(permissionsOfChange0)[0]).toEqual({
      permlevel: 'VIEW',
      permkey: new ReferenceExpression(
        customRecord2.elemID.createNestedID('attr', SCRIPT_ID),
        customRecord2.annotations[SCRIPT_ID],
        customRecord2,
      ),
      restriction: 'VIEWANDEDIT',
    })

    const permissionsOfChange1 =
      isAdditionChange(changes[1]) && isInstanceChange(changes[1])
        ? changes[1].data.after.value.permissions.permission
        : undefined
    expect(isPlainObject(permissionsOfChange1)).toBeTruthy()
    expect(Object.keys(permissionsOfChange1).length).toEqual(3)
    expect(permissionsOfChange1.customrecord_1).toEqual({
      permlevel: 'CREATE',
      permkey: new ReferenceExpression(
        customRecordWithoutPermissions.elemID.createNestedID('attr', SCRIPT_ID),
        customRecordWithoutPermissions.annotations[SCRIPT_ID],
        customRecordWithoutPermissions,
      ),
      restriction: 'EDIT',
    })
    expect(permissionsOfChange1.system_record).toEqual({
      permkey: 'TRAN_PAYMENTAUDIT',
      permlevel: 'EDIT',
    })
    expect(permissionsOfChange1.customrecord_2).toEqual({
      permlevel: 'CREATE',
      permkey: new ReferenceExpression(
        customRecord2.elemID.createNestedID('attr', SCRIPT_ID),
        customRecord2.annotations[SCRIPT_ID],
        customRecord2,
      ),
      restriction: 'EDIT',
    })

    const permissionsOfChange2 = isAdditionChange(changes[2])
      ? changes[2].data.after.annotations.permissions.permission
      : undefined
    expect(isPlainObject(permissionsOfChange2)).toBeTruthy()
    expect(Object.keys(permissionsOfChange2).length).toEqual(1)
    expect(permissionsOfChange2.customrole_2).toEqual({
      permittedlevel: 'CREATE',
      permittedrole: new ReferenceExpression(
        roleWithoutAPermission.elemID.createNestedID(SCRIPT_ID),
        roleWithoutAPermission.value[SCRIPT_ID],
        roleWithoutAPermission,
      ),
      restriction: 'EDIT',
    })
  })
  it('should change modified permissions in the right direction', async () => {
    const afterRole1 = role1.clone()
    afterRole1.value.permissions.permission.customrecord_1.permlevel = 'changed'

    const afterCustomRecord2 = customRecord2.clone()
    afterCustomRecord2.annotations.permissions.permission.customrole_1.permittedlevel = 'changed'

    const changes = [
      toChange({ before: role1, after: afterRole1 }),
      toChange({ before: customRecord1, after: customRecord1 }),
      toChange({ before: customRecord2, after: afterCustomRecord2 }),
    ]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(3)

    const permissionsOfChange0 =
      isModificationChange(changes[0]) && isInstanceChange(changes[0])
        ? changes[0].data.after.value.permissions.permission
        : undefined
    expect(isPlainObject(permissionsOfChange0)).toBeTruthy()
    expect(Object.keys(permissionsOfChange0).length).toEqual(3)
    expect(permissionsOfChange0.customrecord_1.permlevel).toEqual('changed')
    expect(permissionsOfChange0.customrecord_2.permlevel).toEqual('changed')

    const permissionsOfChange1 =
      isModificationChange(changes[1]) && isObjectTypeChange(changes[1])
        ? changes[1].data.after.annotations.permissions.permission
        : undefined
    expect(isPlainObject(permissionsOfChange1)).toBeTruthy()
    expect(Object.keys(permissionsOfChange1).length).toEqual(3)
    expect(permissionsOfChange1.customrole_1.permittedlevel).toEqual('changed')

    const permissionsOfChange2 =
      isModificationChange(changes[2]) && isObjectTypeChange(changes[2])
        ? changes[2].data.after.annotations.permissions.permission
        : undefined
    expect(isPlainObject(permissionsOfChange2)).toBeTruthy()
    expect(Object.keys(permissionsOfChange2).length).toEqual(3)
    expect(permissionsOfChange2.customrole_1.permittedlevel).toEqual('changed')
  })
  it('should add permissions to custom-record/role if there are missing ones', async () => {
    const afterRole1 = role1.clone()
    delete afterRole1.value.permissions.permission.customrecord_1

    const afterCustomRecord2 = customRecord2.clone()
    delete afterCustomRecord2.annotations.permissions.permission.customrole_1

    const changes = [
      toChange({ before: role1, after: afterRole1 }),
      toChange({ before: customRecord1, after: customRecord1 }),
      toChange({ before: customRecord2, after: afterCustomRecord2 }),
    ]
    await filterCreator({ elementsSource } as LocalFilterOpts).preDeploy?.(changes)
    expect(changes.length).toEqual(3)

    const permissionsOfChange0 =
      isModificationChange(changes[0]) && isInstanceChange(changes[0])
        ? changes[0].data.after.value.permissions.permission
        : undefined
    expect(isPlainObject(permissionsOfChange0)).toBeTruthy()
    expect(Object.keys(permissionsOfChange0).length).toEqual(3)
    expect(permissionsOfChange0.customrecord_1).toBeDefined()

    const permissionsOfChange1 =
      isModificationChange(changes[1]) && isObjectTypeChange(changes[1])
        ? changes[1].data.after.annotations.permissions.permission
        : undefined
    expect(isPlainObject(permissionsOfChange1)).toBeTruthy()
    expect(Object.keys(permissionsOfChange1).length).toEqual(3)

    const permissionsOfChange2 =
      isModificationChange(changes[2]) && isObjectTypeChange(changes[2])
        ? changes[2].data.after.annotations.permissions.permission
        : undefined
    expect(isPlainObject(permissionsOfChange2)).toBeTruthy()
    expect(Object.keys(permissionsOfChange2).length).toEqual(3)
    expect(permissionsOfChange2.customrole_1).toBeDefined()
  })
})
