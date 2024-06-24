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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import removeListItemValidator from '../../src/change_validators/remove_list_item_without_scriptid'
import { roleType } from '../../src/autogen/types/standard_types/role'
import { CUSTOM_RECORD_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { workflowType } from '../../src/autogen/types/standard_types/workflow'

describe('remove item without scriptis from inner list change validator', () => {
  const customRecordInstance = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord1'),
    annotationRefsOrTypes: {
      [SCRIPT_ID]: BuiltinTypes.SERVICE_ID,
    },
    annotations: {
      metadataType: CUSTOM_RECORD_TYPE,
      [SCRIPT_ID]: 'customrecord1',
    },
  })
  const originRoleInstance = new InstanceElement('role_test', roleType().type, {
    [SCRIPT_ID]: 'role_test',
    permissions: {
      permission: {
        TRAN_PAYMENTAUDIT: {
          permkey: 'TRAN_PAYMENTAUDIT',
          permlevel: 'EDIT',
        },
        customrecord1: {
          permkey: new ReferenceExpression(
            customRecordInstance.elemID.createNestedID('attr', SCRIPT_ID),
            customRecordInstance.annotations[SCRIPT_ID],
            customRecordInstance,
          ),
          permlevel: 'EDIT',
          restriction: 'no',
        },
      },
    },
  })

  const originRoleWithoutPermissions = new InstanceElement('role_without_permissions_test', roleType().type, {
    [SCRIPT_ID]: 'role_without_permissions_test',
  })

  const originNonRelevantInstance = new InstanceElement('non-relevant', workflowType().type, {
    [SCRIPT_ID]: 'non-relevant',
    name: 'name1',
  })

  const originRoleWithArrayPermissions = new InstanceElement('role_with_array_permission_test', roleType().type, {
    [SCRIPT_ID]: 'role_with_array_permission_test',
    permissions: {
      permission: [
        {
          permkey: 'TRAN_PAYMENTAUDIT',
          permlevel: 'EDIT',
        },
      ],
    },
  })

  const originRoleWithOddPermission = new InstanceElement('role_with_odd_permission_test', roleType().type, {
    [SCRIPT_ID]: 'role_with_odd_permission_test',
    permissions: {
      permission: {
        TRAN_PAYMENTAUDIT: {
          strangeKey: 'TRAN_PAYMENTAUDIT',
          permlevel: 'EDIT',
        },
      },
    },
  })

  let roleInstance: InstanceElement
  let roleWithoutPermissionsInstance: InstanceElement
  let nonRelevantInstance: InstanceElement
  let roleWithArrayPermissionsInstance: InstanceElement
  let roleWithOddPermissionsInstance: InstanceElement

  beforeEach(() => {
    roleInstance = originRoleInstance.clone()
    roleWithoutPermissionsInstance = originRoleWithoutPermissions.clone()
    nonRelevantInstance = originNonRelevantInstance.clone()
    roleWithArrayPermissionsInstance = originRoleWithArrayPermissions.clone()
    roleWithOddPermissionsInstance = originRoleWithOddPermission.clone()
  })

  describe('When adding new instance with inner list', () => {
    it('should have no change errors when adding an instance with inner list', async () => {
      const changeErrors = await removeListItemValidator([
        toChange({ after: roleInstance }),
        toChange({ after: roleWithoutPermissionsInstance }),
        toChange({ after: nonRelevantInstance }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('When modifying instance with inner list', () => {
    it('should have no change errors when adding a permission to the role', async () => {
      const after = roleInstance.clone()
      after.value.permissions.permission.perm = {
        permkey: 'perm',
        permlevel: 'FULL',
      }

      const afterWithoutPermissions = roleWithoutPermissionsInstance.clone()
      afterWithoutPermissions.value.permissions = {
        permission: {
          perm: {
            permkey: 'perm',
            permlevel: 'FULL',
          },
        },
      }

      const afterNonRelevantInstance = nonRelevantInstance.clone()
      afterNonRelevantInstance.value.name = 'name2'
      const changeErrors = await removeListItemValidator([
        toChange({ before: roleInstance, after }),
        toChange({ before: roleWithoutPermissionsInstance, after: afterWithoutPermissions }),
        toChange({ before: nonRelevantInstance, after: afterNonRelevantInstance }),
      ])
      expect(changeErrors).toHaveLength(0)
    })

    it('should have change error when removing a permission from the role', async () => {
      const after = roleInstance.clone()
      delete after.value.permissions.permission.TRAN_PAYMENTAUDIT
      const firstChangeErrors = await removeListItemValidator([toChange({ before: roleInstance, after })])
      expect(firstChangeErrors).toHaveLength(1)
      expect(firstChangeErrors[0].severity).toEqual('Warning')
      expect(firstChangeErrors[0].elemID).toEqual(roleInstance.elemID)
      expect(firstChangeErrors[0].detailedMessage).toEqual(
        "Netsuite doesn't support the removal of inner permission TRAN_PAYMENTAUDIT via API; Salto will ignore this change for this deployment. Please use Netuiste's UI to remove it",
      )

      delete after.value.permissions.permission.customrecord1
      const secondChangeErrors = await removeListItemValidator([toChange({ before: roleInstance, after })])
      expect(secondChangeErrors).toHaveLength(1)
      expect(secondChangeErrors[0].severity).toEqual('Warning')
      expect(secondChangeErrors[0].elemID).toEqual(roleInstance.elemID)
      expect(secondChangeErrors[0].detailedMessage).toEqual(
        "Netsuite doesn't support the removal of inner permissions TRAN_PAYMENTAUDIT, customrecord1 via API; Salto will ignore these changes for this deployment. Please use Netuiste's UI to remove them",
      )
    })

    it('should not have a change error when modifiying a permission from the role', async () => {
      const after = roleInstance.clone()
      after.value.permissions.permission.TRAN_PAYMENTAUDIT = {
        permkey: 'TRAN_PAYMENTAUDIT',
        permlevel: 'FULL',
      }
      after.value.permissions.permission.customrecord1 = {
        permkey: new ReferenceExpression(
          customRecordInstance.elemID.createNestedID('attr', SCRIPT_ID),
          customRecordInstance.annotations[SCRIPT_ID],
          customRecordInstance,
        ),
        permlevel: 'FULL',
      }
      const changeErrors = await removeListItemValidator([toChange({ before: roleInstance, after })])
      expect(changeErrors).toHaveLength(0)
    })
    it('should have a change error when deleting the whole permissions field from the role', async () => {
      const after = roleInstance.clone()
      delete after.value.permissions.permission
      const changeErrors = await removeListItemValidator([toChange({ before: roleInstance, after })])
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(roleInstance.elemID)
      expect(changeErrors[0].detailedMessage).toEqual(
        "Netsuite doesn't support the removal of inner permissions TRAN_PAYMENTAUDIT, customrecord1 via API; Salto will ignore these changes for this deployment. Please use Netuiste's UI to remove them",
      )
    })
    it('should have no change errors when dealing with odd permission in role', async () => {
      const afterWithArray = roleWithArrayPermissionsInstance.clone()
      delete afterWithArray.value.permissions.permission[0]

      const afterWithOddPermission = roleWithOddPermissionsInstance.clone()
      delete afterWithOddPermission.value.permissions.permission.TRAN_PAYMENTAUDIT

      const changeErrors = await removeListItemValidator([
        toChange({ before: roleWithArrayPermissionsInstance, after: afterWithArray }),
        toChange({ before: roleWithOddPermissionsInstance, after: afterWithOddPermission }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })

  describe('When deleting an instance with inner list', () => {
    it('should have no change errors when deleting an instance with inner list', async () => {
      const changeErrors = await removeListItemValidator([
        toChange({ before: roleInstance }),
        toChange({ before: roleWithoutPermissionsInstance }),
        toChange({ before: nonRelevantInstance }),
      ])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
