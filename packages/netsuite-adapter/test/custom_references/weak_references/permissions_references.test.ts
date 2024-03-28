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
  ReferenceExpression,
  isInstanceElement,
  isObjectType,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  getPermissionsListPath,
  permissionsHandler,
} from '../../../src/custom_references/weak_references/permissions_references'
import { roleType } from '../../../src/autogen/types/standard_types/role'
import { NETSUITE, PERMISSIONS, ROLE, SCRIPT_ID } from '../../../src/constants'
import { isCustomRecordType } from '../../../src/types'

describe('permissions_references', () => {
  let role1: InstanceElement
  let role2: InstanceElement
  let role3: InstanceElement
  let custRecord1: ObjectType
  let custRecord2: ObjectType

  const AdapterConfigType = new ObjectType({
    elemID: new ElemID('adapter'),
    isSettings: true,
  })
  const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)

  const roleInstance1 = new InstanceElement('customrole_1', roleType().type, {
    [SCRIPT_ID]: 'customrole_1',
    [PERMISSIONS]: {
      permission: {
        LIST_CUSTRECORDENTRY: {
          permkey: 'LIST_CUSTRECORDENTRY',
          permlevel: 'VIEW',
        },
        customrecord_1: {
          permkey: 'temp',
          permlevel: 'VIEW',
        },
        customrecord_2: {
          permkey: 'temp',
          permlevel: 'EDIT',
        },
        wrong_permission: {
          wrongField: 2,
        },
      },
    },
  })

  const roleInstance2 = new InstanceElement('customrole_2', roleType().type, {
    [SCRIPT_ID]: 'customrole_2',
    [PERMISSIONS]: {
      permission: {
        LIST_CUSTRECORDENTRY: {
          permkey: 'LIST_CUSTRECORDENTRY',
          permlevel: 'VIEW',
        },
        customrecord_1: {
          permkey: 'temp',
          permlevel: 'VIEW',
        },
        customrecord_2: {
          permkey: 'temp',
          permlevel: 'EDIT',
        },
      },
    },
  })
  const roleInstance3 = new InstanceElement('customrole_3', roleType().type, {
    [SCRIPT_ID]: 'customrole_3',
    [PERMISSIONS]: {},
  })

  const custRecordObject1 = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord_1'),
    annotations: {
      metadataType: 'customrecordtype',
      [SCRIPT_ID]: 'customrecord_1',
      permissions: {
        permission: {
          customrole_1: {
            permittedlevel: 'VIEW',
            permittedrole: 'temp',
          },
          customrole_2: {
            permittedlevel: 'VIEW',
            permittedrole: 'temp',
          },
          SYSTEM_ADMINISTRATOR: {
            permittedlevel: 'CREATE',
            permittedrole: 'SYSTEM_ADMINISTRATOR',
            restriction: 'EDIT',
          },
          wrong_permission: {
            wrongField: 2,
          },
        },
      },
    },
  })

  const custRecordObject2 = new ObjectType({
    elemID: new ElemID(NETSUITE, 'customrecord_2'),
    annotations: {
      metadataType: 'customrecordtype',
      [SCRIPT_ID]: 'customrecord_2',
      permissions: {
        permission: {
          customrole_1: {
            permittedlevel: 'VIEW',
            permittedrole: 'temp',
          },
          customrole_2: {
            permittedlevel: 'VIEW',
            permittedrole: 'temp',
          },
          SYSTEM_ADMINISTRATOR: {
            permittedlevel: 'CREATE',
            permittedrole: 'SYSTEM_ADMINISTRATOR',
            restriction: 'EDIT',
          },
        },
      },
    },
  })

  roleInstance1.value.permissions.permission.customrecord_1.permkey = new ReferenceExpression(
    custRecordObject1.elemID.createNestedID('attr', SCRIPT_ID),
    custRecordObject1.annotations.scriptid,
    custRecordObject1,
  )
  roleInstance1.value.permissions.permission.customrecord_2.permkey = new ReferenceExpression(
    custRecordObject2.elemID.createNestedID('attr', SCRIPT_ID),
    custRecordObject2.annotations.scriptid,
    custRecordObject2,
  )

  roleInstance2.value.permissions.permission.customrecord_1.permkey = new ReferenceExpression(
    custRecordObject1.elemID.createNestedID('attr', SCRIPT_ID),
    custRecordObject1.annotations.scriptid,
    custRecordObject1,
  )
  roleInstance2.value.permissions.permission.customrecord_2.permkey = new ReferenceExpression(
    custRecordObject2.elemID.createNestedID('attr', SCRIPT_ID),
    custRecordObject2.annotations.scriptid,
    custRecordObject2,
  )

  custRecordObject1.annotations.permissions.permission.customrole_1.permittedrole = new ReferenceExpression(
    roleInstance1.elemID.createNestedID(SCRIPT_ID),
    roleInstance1.value.scriptid,
    roleInstance1,
  )
  custRecordObject1.annotations.permissions.permission.customrole_2.permittedrole = new ReferenceExpression(
    roleInstance2.elemID.createNestedID(SCRIPT_ID),
    roleInstance2.value.scriptid,
    roleInstance2,
  )

  custRecordObject2.annotations.permissions.permission.customrole_1.permittedrole = new ReferenceExpression(
    roleInstance1.elemID.createNestedID(SCRIPT_ID),
    roleInstance1.value.scriptid,
    roleInstance1,
  )
  custRecordObject2.annotations.permissions.permission.customrole_2.permittedrole = new ReferenceExpression(
    roleInstance2.elemID.createNestedID(SCRIPT_ID),
    roleInstance2.value.scriptid,
    roleInstance2,
  )

  beforeEach(() => {
    role1 = roleInstance1.clone()
    role2 = roleInstance2.clone()
    role3 = roleInstance3.clone()
    custRecord1 = custRecordObject1.clone()
    custRecord2 = custRecordObject2.clone()
  })

  describe('findWeakReferences', () => {
    it('should return weak references for roles permissions', async () => {
      const references = await permissionsHandler.findWeakReferences([role1], adapterConfig)

      expect(references).toEqual([
        {
          source: role1.elemID.createNestedID(...getPermissionsListPath(), 'customrecord_1'),
          target: custRecord1.elemID.createNestedID('attr', SCRIPT_ID),
          type: 'weak',
        },
        {
          source: role1.elemID.createNestedID(...getPermissionsListPath(), 'customrecord_2'),
          target: custRecord2.elemID.createNestedID('attr', SCRIPT_ID),
          type: 'weak',
        },
      ])
    })
    it('should return weak references for custom records permissions', async () => {
      const references = await permissionsHandler.findWeakReferences([custRecord1], adapterConfig)

      expect(references).toEqual([
        {
          source: custRecord1.elemID.createNestedID('attr', ...getPermissionsListPath(), 'customrole_1'),
          target: role1.elemID.createNestedID(SCRIPT_ID),
          type: 'weak',
        },
        {
          source: custRecord1.elemID.createNestedID('attr', ...getPermissionsListPath(), 'customrole_2'),
          target: role2.elemID.createNestedID(SCRIPT_ID),
          type: 'weak',
        },
      ])
    })
  })

  describe('removeWeakReferences', () => {
    it('should remove the invalid references and keep vaid ones from role', async () => {
      const clonedRole1 = role1.clone()
      const elementsSource = buildElementsSourceFromElements([custRecord1])
      const fixes = await permissionsHandler.removeWeakReferences({ elementsSource })([role1])
      expect(clonedRole1).toEqual(role1)

      expect(fixes.errors).toEqual([
        {
          elemID: role1.elemID.createNestedID(...getPermissionsListPath()),
          severity: 'Info',
          message: 'Deploying without all attached permissions',
          detailedMessage:
            'This customrole_1.permissions.permission is referenced by certain customrecordtypes that do not exist in the target environment. As a result, it will be deployed without those references.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      const fixedElement = fixes.fixedElements[0]
      expect(isInstanceElement(fixedElement) && fixedElement.elemID.typeName === ROLE).toBeTruthy()
      const fixedRole = fixedElement as InstanceElement
      expect(fixedRole.value.permissions.permission.customrecord_1).toEqual(
        role1.value.permissions.permission.customrecord_1,
      )
      expect(fixedRole.value.permissions.permission.customrecord_2).toBeUndefined()
      expect(fixedRole.value.permissions.permission.wrong_permission).toBeUndefined()
    })
    it('should remove the invalid references and keep vaid ones from custom record', async () => {
      const clonedCustomRecord = custRecord1.clone()
      const elementsSource = buildElementsSourceFromElements([role1])
      const fixes = await permissionsHandler.removeWeakReferences({ elementsSource })([custRecord1])
      expect(clonedCustomRecord).toEqual(custRecord1)

      expect(fixes.errors).toEqual([
        {
          elemID: custRecord1.elemID.createNestedID('annotation', ...getPermissionsListPath()),
          severity: 'Info',
          message: 'Deploying without all attached permissions',
          detailedMessage:
            'This customrecord_1.annotations.permissions.permission is referenced by certain roles that do not exist in the target environment. As a result, it will be deployed without those references.',
        },
      ])

      expect(fixes.fixedElements).toHaveLength(1)
      const fixedElement = fixes.fixedElements[0]
      expect(isObjectType(fixedElement) && isCustomRecordType(fixedElement)).toBeTruthy()
      const fixedCustomRecord = fixedElement as ObjectType
      expect(fixedCustomRecord.annotations.permissions.permission.customrole_1).toEqual(
        custRecord1.annotations.permissions.permission.customrole_1,
      )
      expect(fixedCustomRecord.annotations.permissions.permission.customrole_2).toBeUndefined()
      expect(fixedCustomRecord.annotations.permissions.permission.wrong_permission).toBeUndefined()
    })

    it('should do nothing if all references are valid', async () => {
      const clonedCustomRecord = custRecord2.clone()
      const clonedRole = role2.clone()
      const elementsSource = buildElementsSourceFromElements([role1, role2, custRecord1, custRecord2])
      const fixes = await permissionsHandler.removeWeakReferences({ elementsSource })([custRecord2, role2])
      expect(clonedCustomRecord).toEqual(custRecord2)
      expect(clonedRole).toEqual(role2)

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })

    it('should do nothing if there is no permission field', async () => {
      const clonedRole3 = role3.clone()
      const elementsSource = buildElementsSourceFromElements([])
      const fixes = await permissionsHandler.removeWeakReferences({ elementsSource })([role3])
      expect(clonedRole3).toEqual(role3)

      expect(fixes.errors).toEqual([])
      expect(fixes.fixedElements).toEqual([])
    })
  })
})
