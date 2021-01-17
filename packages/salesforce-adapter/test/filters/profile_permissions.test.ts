/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, ElemID, CORE_ANNOTATIONS, toChange, InstanceElement, Change, getChangeElement, FieldDefinition, Values, ReferenceExpression } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import filterCreator from '../../src/filters/profile_permissions'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import { ProfileInfo } from '../../src/client/types'
import mockClient from '../client'
import { Types, createInstanceElement, metadataType, apiName } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'

describe('Object Permissions filter', () => {
  const { client } = mockClient()

  const createField = (
    parent: string,
    name: string,
    annotations: Values = {},
    refType: ReferenceExpression = createRefToElmWithValue(Types.primitiveDataTypes.Text),
  ): Record<string, FieldDefinition> => ({
    [name]: { refType, annotations: { [constants.API_NAME]: `${parent}.${name}`, ...annotations } },
  })

  const mockObject = (name: string): ObjectType => new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, name),
    annotations: {
      label: 'test label',
      [constants.API_NAME]: name,
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    },
    fields: {
      ...createField(name, 'desc__c'),
      ...createField(name, 'req__c', { [CORE_ANNOTATIONS.REQUIRED]: true }),
      ...createField(name, 'master__c', {}, createRefToElmWithValue(Types.primitiveDataTypes.MasterDetail)),
      ...createField(name, 'standard'),
    },
  })
  const mockAdminProfile = (
    objectPermissions: ProfileInfo['objectPermissions'],
    fieldPermissions: ProfileInfo['fieldPermissions'],
  ): InstanceElement => createInstanceElement(
    { fullName: 'Admin', objectPermissions, fieldPermissions },
    mockTypes.Profile,
  )

  let filter: FilterWith<'preDeploy' | 'onDeploy'>

  describe('with new object, new fields and no permission change', () => {
    let changes: Change[]
    beforeAll(() => {
      filter = filterCreator({ client, config: {} }) as typeof filter
    })
    describe('preDeploy', () => {
      beforeAll(async () => {
        const objWithNewField = mockObject('Test2__c')
        changes = [
          toChange({ after: mockObject('Test__c') }),
          toChange({ after: objWithNewField.fields.desc__c }),
        ]
        await filter.preDeploy(changes)
      })
      it('should create a change for the admin profile', () => {
        expect(changes).toHaveLength(3)
      })
      describe('admin profile change', () => {
        let adminProfile: InstanceElement
        beforeAll(() => {
          adminProfile = getChangeElement(changes[2]) as InstanceElement
        })
        it('should be a profile instance', async () => {
          expect(adminProfile).toBeInstanceOf(InstanceElement)
          expect(await metadataType(adminProfile)).toEqual(constants.PROFILE_METADATA_TYPE)
          expect(await apiName(adminProfile)).toEqual(constants.ADMIN_PROFILE)
        })
        it('should have object permission for new object', () => {
          expect(adminProfile.value.objectPermissions).toContainEqual({
            object: 'Test__c',
            allowCreate: true,
            allowDelete: true,
            allowEdit: true,
            allowRead: true,
            modifyAllRecords: true,
            viewAllRecords: true,
          })
        })
        it('should have field permissions for new field in new object', () => {
          expect(adminProfile.value.fieldPermissions).toContainEqual({
            field: 'Test__c.desc__c',
            readable: true,
            editable: true,
          })
        })
        it('should have field permissions for new field in existing object', () => {
          expect(adminProfile.value.fieldPermissions).toContainEqual({
            field: 'Test2__c.desc__c',
            readable: true,
            editable: true,
          })
        })
        it('should not add permissions for required fields', () => {
          expect(adminProfile.value.fieldPermissions).not.toContainEqual(
            expect.objectContaining({ field: 'Test__c.req__c' })
          )
        })
        it('should not add permissions for master-detail fields', () => {
          expect(adminProfile.value.fieldPermissions).not.toContainEqual(
            expect.objectContaining({ field: 'Test__c.master__c' })
          )
        })
        it('should not add permissions for non-custom fields', () => {
          expect(adminProfile.value.fieldPermissions).not.toContainEqual(
            expect.objectContaining({ field: 'Test__c.standard' })
          )
        })
      })
    })
    describe('onDeploy', () => {
      beforeAll(async () => {
        await filter.onDeploy(changes)
      })
      it('should remove the admin profile change', () => {
        expect(changes).toHaveLength(2)
      })
    })
  })

  describe('with new object, new fields and manual permissions', () => {
    let changes: Change[]
    const presetObjectPermission: ProfileInfo['objectPermissions'][0] = {
      object: 'Test__c',
      allowCreate: true,
      allowDelete: false,
      allowEdit: false,
      allowRead: true,
      modifyAllRecords: false,
      viewAllRecords: true,
    }
    const presetFieldPermission: ProfileInfo['fieldPermissions'][0] = {
      field: 'Test2__c.desc__c', readable: true, editable: false,
    }
    beforeAll(() => {
      filter = filterCreator({ client, config: {} }) as typeof filter
    })
    describe('preDeploy', () => {
      beforeAll(async () => {
        const objWithNewField = mockObject('Test2__c')
        const updatedProfile = mockAdminProfile(
          [presetObjectPermission], [presetFieldPermission],
        )
        changes = [
          toChange({ after: mockObject('Test__c') }),
          toChange({ after: objWithNewField.fields.desc__c }),
          toChange({ before: mockAdminProfile([], []), after: updatedProfile }),
        ]
        await filter.preDeploy(changes)
      })
      it('should use the existing change for the admin profile', () => {
        expect(changes).toHaveLength(3)
      })
      describe('admin profile change', () => {
        let adminProfile: InstanceElement
        beforeAll(() => {
          adminProfile = getChangeElement(changes[2]) as InstanceElement
        })
        it('should be a profile instance', async () => {
          expect(adminProfile).toBeInstanceOf(InstanceElement)
          expect(await metadataType(adminProfile)).toEqual(constants.PROFILE_METADATA_TYPE)
          expect(await apiName(adminProfile)).toEqual(constants.ADMIN_PROFILE)
        })
        it('should not change permissions that already exist in the updated profile', () => {
          expect(adminProfile.value.objectPermissions).toContainEqual(presetObjectPermission)
          expect(adminProfile.value.fieldPermissions).toContainEqual(presetFieldPermission)
        })
        it('should add field permissions for new fields that are missing in the profile', () => {
          expect(adminProfile.value.fieldPermissions).toContainEqual({
            field: 'Test__c.desc__c',
            readable: true,
            editable: true,
          })
        })
      })
    })
    describe('onDeploy', () => {
      beforeAll(async () => {
        await filter.onDeploy(changes)
      })
      it('should not remove the admin profile change', () => {
        expect(changes).toHaveLength(3)
      })
    })
  })
})
