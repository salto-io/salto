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
  ObjectType,
  ElemID,
  CORE_ANNOTATIONS,
  toChange,
  InstanceElement,
  Change,
  getChangeData,
  FieldDefinition,
  Values,
  TypeReference,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { isDefined } from '@salto-io/lowerdash/src/values'
import filterCreator from '../../src/filters/profile_permissions'
import * as constants from '../../src/constants'
import { ProfileInfo } from '../../src/client/types'
import {
  Types,
  createInstanceElement,
  metadataType,
  apiName,
} from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'
import {
  apiNameSync,
  isInstanceOfTypeChangeSync,
} from '../../src/filters/utils'

describe('Profile Permissions filter', () => {
  const TEST_PROFILE = 'Test Profile'
  const REMOVED_PROFILE = 'Removed Profile'

  const createField = (
    parent: string,
    name: string,
    annotations: Values = {},
    refType: TypeReference = createRefToElmWithValue(
      Types.primitiveDataTypes.Text,
    ),
  ): Record<string, FieldDefinition> => ({
    [name]: {
      refType,
      annotations: {
        [constants.API_NAME]: `${parent}.${name}`,
        ...annotations,
      },
    },
  })

  const mockObject = (name: string): ObjectType =>
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, name),
      annotations: {
        label: 'test label',
        [constants.API_NAME]: name,
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      },
      fields: {
        ...createField(name, 'desc__c'),
        ...createField(name, 'req__c', { [CORE_ANNOTATIONS.REQUIRED]: true }),
        ...createField(
          name,
          'master__c',
          {},
          createRefToElmWithValue(Types.primitiveDataTypes.MasterDetail),
        ),
        ...createField(name, 'standard'),
      },
    })
  const mockFLSProfile = (
    objectPermissions: ProfileInfo['objectPermissions'],
    fieldPermissions: ProfileInfo['fieldPermissions'],
    fullName = 'Admin',
  ): InstanceElement =>
    createInstanceElement(
      { fullName, objectPermissions, fieldPermissions },
      mockTypes.Profile,
    )

  const getChangeProfilesNames = (changes: Change[]): string[] =>
    changes
      .filter(isInstanceOfTypeChangeSync(constants.PROFILE_METADATA_TYPE))
      .map(getChangeData)
      .map((instance) => apiNameSync(instance))
      .filter(isDefined)

  let filter: FilterWith<'preDeploy' | 'onDeploy'>

  describe('with new object, new fields and no permission change', () => {
    let changes: Change[]
    beforeEach(() => {
      filter = filterCreator({ config: defaultFilterContext }) as typeof filter
    })
    describe('preDeploy', () => {
      beforeEach(async () => {
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
        beforeEach(() => {
          adminProfile = getChangeData(changes[2]) as InstanceElement
        })
        it('should be a profile instance', async () => {
          expect(adminProfile).toBeInstanceOf(InstanceElement)
          expect(await metadataType(adminProfile)).toEqual(
            constants.PROFILE_METADATA_TYPE,
          )
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
            expect.objectContaining({ field: 'Test__c.req__c' }),
          )
        })
        it('should not add permissions for master-detail fields', () => {
          expect(adminProfile.value.fieldPermissions).not.toContainEqual(
            expect.objectContaining({ field: 'Test__c.master__c' }),
          )
        })
        it('should not add permissions for non-custom fields', () => {
          expect(adminProfile.value.fieldPermissions).not.toContainEqual(
            expect.objectContaining({ field: 'Test__c.standard' }),
          )
        })
      })
    })
    describe('onDeploy', () => {
      beforeEach(async () => {
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
      field: 'Test2__c.desc__c',
      readable: true,
      editable: false,
    }
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          flsProfiles: [constants.ADMIN_PROFILE, TEST_PROFILE, REMOVED_PROFILE],
        },
      }) as typeof filter
    })
    describe('preDeploy & onDeploy', () => {
      beforeEach(() => {
        const objWithNewField = mockObject('Test2__c')
        const updatedProfile = mockFLSProfile(
          [presetObjectPermission],
          [presetFieldPermission],
        )
        changes = [
          toChange({ after: mockObject('Test__c') }),
          toChange({ after: objWithNewField.fields.desc__c }),
          toChange({ before: mockFLSProfile([], []), after: updatedProfile }),
          toChange({ before: mockFLSProfile([], [], REMOVED_PROFILE) }),
        ]
      })
      it('should have correct changes pre & on deploy', async () => {
        await filter.preDeploy(changes)
        expect(changes).toHaveLength(5)
        // Make sure we have a change per FLS Profile on preDeploy
        expect(getChangeProfilesNames(changes)).toIncludeSameMembers([
          constants.ADMIN_PROFILE,
          TEST_PROFILE,
          REMOVED_PROFILE,
        ])

        // Make sure we remove the custom changes we've created on onDeploy (Test Profile)
        await filter.onDeploy(changes)
        expect(getChangeProfilesNames(changes)).toIncludeSameMembers([
          constants.ADMIN_PROFILE,
          REMOVED_PROFILE,
        ])
      })
    })
  })
})
