/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { InstanceElement, isMapType, getDeepInnerType, ObjectType, ElemID, MapType, toChange, getChangeData, Change } from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import * as constants from '../../src/constants'
import fieldPermissionsEnumFilter, { enumFieldPermissions, profileFieldLevelSecurity } from '../../src/filters/field_permissions_enum'
import { generateProfileType, defaultFilterContext } from '../utils'

describe('FieldPermissionsEnum filter', () => {
  let filter: FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  const profileObj = generateProfileType(true)
  const permissionSetObject = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, constants.PERMISSION_SET_METADATA_TYPE),
    fields: {
      fieldPermissions: { refType: new MapType(new MapType(profileFieldLevelSecurity)) },
    },
    annotations: {
      [constants.METADATA_TYPE]: constants.PERMISSION_SET_METADATA_TYPE,
    },
  })
  const fieldPermissionObjectValue = {
    ObjA: {
      FieldA: {
        field: 'ObjA.FieldA',
        editable: true,
        readable: true,
      },
      FieldB: {
        field: 'ObjA.FieldB',
        editable: false,
        readable: true,
      },
      FieldC: {
        field: 'ObjA.FieldC',
        editable: false,
        readable: false,
      },
    },
    ObjB: {
      FieldA: {
        field: 'ObjB.FieldA',
        editable: false,
        readable: false,
      },
      FieldB: {
        field: 'ObjB.FieldB',
        editable: false,
        readable: true,
      },
      FieldC: {
        field: 'ObjB.FieldC',
        editable: true,
        readable: true,
      },
    },
  }
  const fieldPermissionEnumValue = {
    ObjA: {
      FieldA: 'ReadWrite',
      FieldB: 'ReadOnly',
      FieldC: 'NoAccess',
    },
    ObjB: {
      FieldA: 'NoAccess',
      FieldB: 'ReadOnly',
      FieldC: 'ReadWrite',
    },
  }
  const profileInstance = new InstanceElement(
    'profileInst',
    profileObj,
    {
      fieldPermissions: fieldPermissionObjectValue,
    }
  )
  const permissionSetInstance = new InstanceElement(
    'permissionSetInst',
    permissionSetObject,
    {
      fieldPermissions: fieldPermissionObjectValue,
    }
  )

  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]
    let profileInstanceClone: InstanceElement
    let permissionSetInstanceClone: InstanceElement
    let permissionSetObjectClone: ObjectType
    let profileObjectClone: ObjectType
    describe('with enumFieldPermissions true', () => {
      beforeAll(async () => {
        profileInstanceClone = profileInstance.clone()
        permissionSetInstanceClone = permissionSetInstance.clone()
        permissionSetObjectClone = permissionSetObject.clone()
        profileObjectClone = profileObj.clone()
        elements = [
          profileObjectClone,
          permissionSetObjectClone,
          profileInstanceClone,
          permissionSetInstanceClone,
        ]
        filter = fieldPermissionsEnumFilter(
          { config: { ...defaultFilterContext, enumFieldPermissions: true } },
        ) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
        await filter.onFetch(elements)
      })

      it('Should convert Profile Object fieldPermissions type to fieldPermissionEnum', async () => {
        const fieldPermissionsFieldType = await (profileObjectClone)
          .fields.fieldPermissions.getType()
        expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
        const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
        expect(deepInnerFieldPermissionType.elemID.isEqual(enumFieldPermissions.elemID))
          .toBeTruthy()
      })

      it('Should convert PermissionSet Object fieldPermissions type to fieldPermissionEnum', async () => {
        const fieldPermissionsFieldType = await (permissionSetObjectClone)
          .fields.fieldPermissions.getType()
        expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
        const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
        expect(deepInnerFieldPermissionType.elemID.isEqual(enumFieldPermissions.elemID))
          .toBeTruthy()
      })

      it('Should convert Profile and PermissionSet instances\' fieldPermissions values to right enums', async () => {
        [profileInstanceClone, permissionSetInstanceClone].forEach(instance => {
          expect(instance.value).toEqual({
            fieldPermissions: fieldPermissionEnumValue,
          })
        })
      })
    })

    describe('with enumFieldPermissions false', () => {
      beforeAll(async () => {
        filter = fieldPermissionsEnumFilter(
          { config: { ...defaultFilterContext } },
        ) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
        profileInstanceClone = profileInstance.clone()
        permissionSetInstanceClone = permissionSetInstance.clone()
        permissionSetObjectClone = permissionSetObject.clone()
        profileObjectClone = profileObj.clone()
        elements = [
          profileObjectClone,
          permissionSetObjectClone,
          profileInstanceClone,
          permissionSetInstanceClone,
        ]
        await filter.onFetch(elements)
      })

      it('Should not change the Profile and PermissionSet objects', async () => {
        expect(profileObj.isEqual(profileObjectClone)).toBeTruthy()
        expect(permissionSetObject.isEqual(permissionSetObjectClone)).toBeTruthy()
      })

      it('Should not change Profile and PermissionSet instances', () => {
        expect(profileInstance.isEqual(profileInstanceClone)).toBeTruthy()
        expect(permissionSetInstance.isEqual(permissionSetInstanceClone)).toBeTruthy()
      })
    })
  })

  describe('deploy (pre + on)', () => {
    const permissionSetObjectPostOnFetch = new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, constants.PERMISSION_SET_METADATA_TYPE),
      fields: {
        fieldPermissions: { refType: new MapType(new MapType(enumFieldPermissions)) },
      },
      annotations: {
        [constants.METADATA_TYPE]: constants.PERMISSION_SET_METADATA_TYPE,
      },
    })
    const profileObjectPostOnFetch = new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, constants.PROFILE_METADATA_TYPE),
      fields: {
        fieldPermissions: { refType: new MapType(new MapType(enumFieldPermissions)) },
      },
      annotations: {
        [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
      },
    })
    const profileInstancePostOnFetch = new InstanceElement(
      'profileInstPostOnFetch',
      profileObjectPostOnFetch,
      {
        fieldPermissions: fieldPermissionEnumValue,
      }
    )
    const permissionSetInstancePostOnFetch = new InstanceElement(
      'permissionSetInstPostOnFetch',
      permissionSetObjectPostOnFetch,
      {
        fieldPermissions: fieldPermissionEnumValue,
      }
    )
    let changes: Change<InstanceElement>[]
    describe('with enumFieldPermissions true', () => {
      beforeAll(async () => {
        filter = fieldPermissionsEnumFilter(
          { config: { ...defaultFilterContext, enumFieldPermissions: true } },
        ) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
      })

      describe('preDeploy', () => {
        beforeAll(async () => {
          changes = [
            profileInstancePostOnFetch,
            permissionSetInstancePostOnFetch,
            profileInstance,
            permissionSetInstance,
          ].map(elem => toChange({ after: elem.clone() }))
          await filter.preDeploy(changes)
        })

        it('Should have instances with fieldPermission Object values', () => {
          changes.forEach(change => {
            const instance = getChangeData(change)
            expect(instance.value.fieldPermissions).toEqual(fieldPermissionObjectValue)
          })
        })

        it('Should have instances\' type fieldPermission field type as profileFieldLevelSecurity map type', async () => {
          changes.forEach(async change => {
            const fieldPermissionsFieldType = await (await getChangeData(change).getType())
              .fields.fieldPermissions.getType()
            expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
            const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
            expect(deepInnerFieldPermissionType.elemID.isEqual(profileFieldLevelSecurity.elemID))
              .toBeTruthy()
          })
        })
      })

      describe('onDeploy', () => {
        beforeAll(async () => {
          changes = [
            profileInstance,
            permissionSetInstance,
          ].map(elem => toChange({ after: elem.clone() }))
          // The postOnFetch instances are irrelevant
          await filter.onDeploy(changes)
        })

        it('Should have instances with fieldPermission Enum values', () => {
          changes.forEach(change => {
            const instance = getChangeData(change)
            expect(instance.value.fieldPermissions).toEqual(fieldPermissionEnumValue)
          })
        })

        it('Should have instances\' type fieldPermission field type as enumFieldPermissions map type', async () => {
          changes.forEach(async change => {
            const fieldPermissionsFieldType = await (await getChangeData(change).getType())
              .fields.fieldPermissions.getType()
            expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
            const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
            expect(deepInnerFieldPermissionType.elemID.isEqual(enumFieldPermissions.elemID))
              .toBeTruthy()
          })
        })
      })
    })

    describe('with enumFieldPermissions false', () => {
      beforeAll(async () => {
        filter = fieldPermissionsEnumFilter(
          { config: { ...defaultFilterContext } },
        ) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
      })

      describe('preDeploy', () => {
        beforeAll(async () => {
          changes = [
            profileInstancePostOnFetch,
            permissionSetInstancePostOnFetch,
            profileInstance,
            permissionSetInstance,
          ].map(elem => toChange({ after: elem.clone() }))
          await filter.preDeploy(changes)
        })

        it('Should have instances with fieldPermission Object values', () => {
          changes.forEach(change => {
            const instance = getChangeData(change)
            expect(instance.value.fieldPermissions).toEqual(fieldPermissionObjectValue)
          })
        })

        it('Should have instances\' type fieldPermission field type as profileFieldLevelSecurity map type', async () => {
          changes.forEach(async change => {
            const fieldPermissionsFieldType = await (await getChangeData(change).getType())
              .fields.fieldPermissions.getType()
            expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
            const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
            expect(deepInnerFieldPermissionType.elemID.isEqual(profileFieldLevelSecurity.elemID))
              .toBeTruthy()
          })
        })
      })

      describe('onDeploy', () => {
        beforeAll(async () => {
          changes = [
            profileInstance,
            permissionSetInstance,
          ].map(elem => toChange({ after: elem.clone() }))
          // The postOnFetch instances are irrelevant
          await filter.onDeploy(changes)
        })

        it('Should have instances with fieldPermission Object values', () => {
          changes.forEach(change => {
            const instance = getChangeData(change)
            expect(instance.value.fieldPermissions).toEqual(fieldPermissionObjectValue)
          })
        })

        it('Should have instances\' type fieldPermission field type as profileFieldLevelSecurity map type', async () => {
          changes.forEach(async change => {
            const fieldPermissionsFieldType = await (await getChangeData(change).getType())
              .fields.fieldPermissions.getType()
            expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
            const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
            expect(deepInnerFieldPermissionType.elemID.isEqual(profileFieldLevelSecurity.elemID))
              .toBeTruthy()
          })
        })
      })
    })
  })
})
