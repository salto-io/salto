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
import {
  ObjectType, ElemID, PrimitiveType, Field, PrimitiveTypes,
  InstanceElement, isObjectType, BuiltinTypes, CORE_ANNOTATIONS, ReferenceExpression,
} from 'adapter-api'
import _ from 'lodash'
import { metadataType } from '../../src/transformers/transformer'
import { ProfileInfo, FieldPermissions } from '../../src/client/types'
import filterCreator, { getProfileInstances } from '../../src/filters/profile_permissions'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

const {
  FIELD_LEVEL_SECURITY_ANNOTATION, ADMIN_PROFILE, PROFILE_METADATA_TYPE, SALESFORCE,
  INSTANCE_FULL_NAME_FIELD,
} = constants

describe('Field Permissions filter', () => {
  const { client } = mockClient()
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  const descriptionFieldName = 'Description__c'
  const noStandardFieldName = 'No_standard__c'
  const stringType = new PrimitiveType({
    elemID: new ElemID(constants.SALESFORCE, 'string'),
    primitive: PrimitiveTypes.STRING,
  })
  const mockObject = new ObjectType({
    elemID: mockElemID,
    fields: {
      [descriptionFieldName]:
        new Field(mockElemID, descriptionFieldName, stringType,
          { [constants.API_NAME]: `Test__c.${descriptionFieldName}` }),
      [noStandardFieldName]:
          new Field(mockElemID, noStandardFieldName, stringType,
            { [constants.API_NAME]: `Test__c.${noStandardFieldName}` }),
    },
    annotations: {
      label: 'test label',
      [constants.API_NAME]: 'Test__c',
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    },
  })
  const plusFieldName = 'Plus__c'
  const mockExtendedObject = new ObjectType({
    elemID: mockElemID,
    fields: {
      [plusFieldName]:
        new Field(mockElemID, plusFieldName, stringType,
          { [constants.API_NAME]: `Test__c.${plusFieldName}` }),
    },
  })

  const STANDARD_NAME = 'Standard'
  const ANALYTICS_CLOUD_INTEGRATION_USER_NAME = 'Analytics Cloud Integration User'
  const admin = {
    [FIELD_LEVEL_SECURITY_ANNOTATION]:
      { editable: [ADMIN_PROFILE], readable: [ADMIN_PROFILE] },
  }
  const standard = {
    [FIELD_LEVEL_SECURITY_ANNOTATION]: { readable: [STANDARD_NAME] },
  }
  const addStandard = (field: Field): void =>
    field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION].readable.push(STANDARD_NAME)

  const addAnalyticsCloudIntegrationUser = (field: Field): void =>
    field.annotations[FIELD_LEVEL_SECURITY_ANNOTATION].readable.push(
      ANALYTICS_CLOUD_INTEGRATION_USER_NAME
    )


  const mockProfileElemID = new ElemID(SALESFORCE, PROFILE_METADATA_TYPE)
  const mockFieldPermissions = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'profile_field_level_security'),
    fields: {},
    annotations: { [constants.METADATA_TYPE]: 'ProfileFieldLevelSecurity' },
  })
  const mockProfile = new ObjectType({
    elemID: mockProfileElemID,
    fields: {
      [constants.FIELD_PERMISSIONS]: new Field(
        mockProfileElemID, constants.FIELD_PERMISSIONS, mockFieldPermissions,
      ),
      [INSTANCE_FULL_NAME_FIELD]:
        new Field(mockProfileElemID, INSTANCE_FULL_NAME_FIELD, BuiltinTypes.SERVICE_ID),
    },
    annotationTypes: {},
    annotations: {
      [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
      [constants.API_NAME]: 'Profile',
    },
  })
  const mockAdmin = new InstanceElement(ADMIN_PROFILE,
    mockProfile,
    {
      [constants.FIELD_PERMISSIONS]: [
        {
          field: `Test__c.${descriptionFieldName}`,
          readable: 'true',
          editable: 'false',
        },
        {
          field: 'Test__c.Plus__c',
          readable: 'true',
          editable: 'false',
        },
        {
          field: 'Test__c.No_standard__c',
          readable: 'true',
          editable: 'true',
        },
      ],
      description: 'Admin profile',
      [INSTANCE_FULL_NAME_FIELD]: 'Admin',
    })
  const mockStandard = new InstanceElement('Standard',
    mockProfile,
    {
      [constants.FIELD_PERMISSIONS]: [
        {
          field: `Test__c.${descriptionFieldName}`,
          readable: 'false',
          editable: 'true',
        },
        {
          field: 'Test__c.No_standard__c',
          readable: 'false',
          editable: 'false',
        },
      ],
      description: 'Standard profile',
      [INSTANCE_FULL_NAME_FIELD]: 'Standard',
    })
  const mockNoFieldPerm = new InstanceElement('fake_no_field_permissions',
    mockProfile,
    {
      description: 'Profile with no field_permissions',
    })

  const addressFieldName = 'address__c'
  const bananaFieldName = 'banana__c'
  const appleFieldName = 'apple__c'
  const deltaFieldName = 'delta__c'
  const address = new Field(mockElemID, addressFieldName, stringType, _.merge({},
    { ...admin, [constants.API_NAME]: `Test__c.${addressFieldName}` }))
  const banana = new Field(mockElemID, bananaFieldName, stringType, _.merge({},
    { ...admin, [constants.API_NAME]: `Test__c.${bananaFieldName}` }))
  const apple = new Field(mockElemID, appleFieldName, stringType, _.merge({},
    { ...admin, [constants.API_NAME]: `Test__c.${appleFieldName}` }))
  const delta = new Field(mockElemID, deltaFieldName, stringType, _.merge({},
    { ...admin, [constants.API_NAME]: `Test__c.${deltaFieldName}` }))
  addStandard(delta)

  let mockUpdate: jest.Mock

  type FilterType = FilterWith<'onFetch' | 'onAdd' | 'onUpdate'>
  const filter = (): FilterType => filterCreator({ client }) as FilterType

  const verifyUpdateCall = (profileName: string, fieldName: string, editable = true,
    readable = true): void => {
    expect(mockUpdate.mock.calls.length).toBe(1)
    const profiles = mockUpdate.mock.calls[0][1] as ProfileInfo[]
    const profile = profiles.find(p => p.fullName === profileName) as ProfileInfo
    const fieldPermissions = profile.fieldPermissions
      .find(f => f.field === fieldName) as FieldPermissions
    expect(fieldPermissions.editable).toBe(editable)
    expect(fieldPermissions.readable).toBe(readable)
  }

  beforeEach(() => {
    mockUpdate = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
    client.update = mockUpdate
  })
  it('should add field_level_security to object types and remove it from profile type & instances',
    async () => {
      const elements = [mockObject.clone(), mockExtendedObject.clone(), mockAdmin, mockStandard,
        mockNoFieldPerm, mockProfile]
      await filter().onFetch(elements)
      const objectTypes = elements.filter(isObjectType)

      // Check mockObject has the right permissions
      const fieldLevelSecurity = objectTypes[0].fields[descriptionFieldName]
        .annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
      expect(fieldLevelSecurity.readable[0].elemId).toEqual(
        mockAdmin.elemID
      )
      expect(fieldLevelSecurity.editable[0].elemId).toEqual(
        mockStandard.elemID
      )

      const fieldLevelSecurityPlus = objectTypes[1].fields[plusFieldName]
        .annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
      expect(fieldLevelSecurityPlus.readable[0].elemId).toEqual(
        mockAdmin.elemID
      )
      expect(fieldLevelSecurityPlus.editable).toEqual([])

      const fieldLevelSecurityNoStandard = objectTypes[0].fields[noStandardFieldName]
        .annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
      expect(fieldLevelSecurityNoStandard.readable[0].elemId).toEqual(
        mockAdmin.elemID
      )
      expect(fieldLevelSecurityNoStandard.editable[0].elemId).toEqual(
        mockAdmin.elemID
      )

      // Check profile instances' field_permissions were deleted
      getProfileInstances(elements)
        .forEach(profileInstance => expect(profileInstance.value[constants.FIELD_PERMISSIONS])
          .toBeUndefined())

      // Check Profile type's field_permissions field was deleted
      const profileType = elements.filter(isObjectType)
        .filter(elem => metadataType(elem) === PROFILE_METADATA_TYPE)[0]
      expect(profileType).toBeDefined()
      expect(profileType.fields[constants.FIELD_PERMISSIONS]).toBeUndefined()
    })

  it('should update field permissions upon new salesforce type', async () => {
    const after = mockObject.clone()
    _.merge(after.fields[descriptionFieldName].annotations, admin)
    addStandard(after.fields[descriptionFieldName])
    addAnalyticsCloudIntegrationUser(after.fields[descriptionFieldName])

    await filter().onAdd(after)

    // Verify permissions creation
    verifyUpdateCall(ADMIN_PROFILE, `Test__c.${descriptionFieldName}`)
    verifyUpdateCall(ANALYTICS_CLOUD_INTEGRATION_USER_NAME, `Test__c.${descriptionFieldName}`, false, true)
    verifyUpdateCall(STANDARD_NAME, `Test__c.${descriptionFieldName}`, false, true)
  })

  it('should fail field permissions filter add due to sfdc error', async () => {
    client.update = jest.fn().mockImplementation(() => ([{
      success: false,
      errors: [
        {
          message: 'Failed to update profile',
        },
      ],
    }]))
    const after = mockObject.clone()
    _.merge(after.fields[descriptionFieldName].annotations, admin)
    const result = await filter().onAdd(after)

    expect(result[0].success).toBe(false)
  })

  it('should only update new fields and new permissions upon update', async () => {
    const before = mockObject.clone()
    before.fields = { ...before.fields, [addressFieldName]: address, [bananaFieldName]: banana }

    const after = before.clone()
    // Add apple field
    after.fields = { ...after.fields, [appleFieldName]: apple }
    // Add permissions to existing field
    _.merge(after.fields[descriptionFieldName].annotations, admin)
    await filter().onUpdate(before, after,
      [
        { action: 'add', data: { after: apple } },
        { action: 'modify',
          data: {
            before: before.fields[descriptionFieldName],
            after: after.fields[descriptionFieldName],
          } },
      ])

    // Verify the field permissions update
    verifyUpdateCall(ADMIN_PROFILE, `Test__c.${descriptionFieldName}`)
    verifyUpdateCall(ADMIN_PROFILE, `Test__c.${appleFieldName}`)
  })

  it('should update field permissions upon update that include add and remove of fields',
    async () => {
      const before = mockObject.clone()
      before.fields = { [addressFieldName]: address, [bananaFieldName]: banana }

      // After - banana was removed and apple was added
      const after = mockObject.clone()
      after.fields = { [addressFieldName]: address, [appleFieldName]: apple }

      await filter().onUpdate(before, after, [
        { action: 'add', data: { after: apple } },
        { action: 'remove', data: { before: banana } },
      ])

      // Verify the field permissions update
      verifyUpdateCall(ADMIN_PROFILE, `Test__c.${appleFieldName}`)
    })

  it('should not call update on remove field',
    async () => {
      const before = mockObject.clone()
      before.fields = { [addressFieldName]: address }

      const after = mockObject.clone()
      after.fields = { }

      await filter().onUpdate(before, after, [
        { action: 'remove', data: { before: address } },
      ])

      // Verify there was no update call
      expect(mockUpdate).not.toHaveBeenCalled()
    })

  it('should update the new profile on existing field', async () => {
    const before = mockObject.clone()
    before.fields = { ...before.fields, [addressFieldName]: address }
    const after = before.clone()
    // Add admin permissions with readable=true and editable=false for description field
    after.fields[descriptionFieldName]
      .annotations[FIELD_LEVEL_SECURITY_ANNOTATION] = { readable: [ADMIN_PROFILE] }
    // Add standard profile field permissions to address
    addStandard(after.fields[addressFieldName])

    await filter().onUpdate(before, after, [
      { action: 'modify',
        data: { before: before.fields[descriptionFieldName],
          after: after.fields[descriptionFieldName] } },
      { action: 'modify',
        data: { before: before.fields[addressFieldName],
          after: after.fields[addressFieldName] } },
    ])

    // Verify the field permissions creation
    verifyUpdateCall(ADMIN_PROFILE, `Test__c.${descriptionFieldName}`, false, true)
    verifyUpdateCall(STANDARD_NAME, `Test__c.${addressFieldName}`, false, true)
  })

  it('should properly update the remaining fields permissions of the object', async () => {
    const before = mockObject.clone()
    before.fields = {
      [addressFieldName]: address.clone(),
      [bananaFieldName]: banana,
      [appleFieldName]: apple,
    }
    // Add standard to address field (on top of admin)
    addStandard(before.fields[addressFieldName])
    // Banana field will have only standard permissions
    before.fields[bananaFieldName].annotations = {
      [constants.API_NAME]: before.fields[bananaFieldName].annotations[constants.API_NAME],
      ...standard,
    }

    // after we have address with only standard and delta that has both admin and standard
    const after = mockObject.clone()
    after.fields = {
      [addressFieldName]: address, [deltaFieldName]: delta, [appleFieldName]: apple.clone(),
    }
    // Remove admin permissions from address field
    after.fields[addressFieldName].annotations = {
      [constants.API_NAME]: before.fields[addressFieldName].annotations[constants.API_NAME],
      ...standard,
    }
    // Apple has no field permissions as all
    after.fields[appleFieldName].annotations = {
      [constants.API_NAME]: after.fields[appleFieldName].annotations[constants.API_NAME],
    }
    await filter().onUpdate(before, after, [
      { action: 'modify', data: { before: before.fields[addressFieldName], after: after.fields[addressFieldName] } },
      { action: 'remove', data: { before: before.fields[bananaFieldName] } },
      { action: 'modify', data: { before: before.fields[appleFieldName], after: after.fields[appleFieldName] } },
      { action: 'add', data: { after: after.fields[deltaFieldName] } },
    ])

    // Verify the field permissions change
    verifyUpdateCall(STANDARD_NAME, `Test__c.${deltaFieldName}`, false, true)

    // Banana field was removed so no need to explicitly remove from profile
    const adminProfile = mockUpdate.mock.calls[0][1][1]
    expect(adminProfile.fullName).toBe(ADMIN_PROFILE)
    expect(adminProfile.fieldPermissions.length).toBe(3)
    expect(adminProfile.fieldPermissions[0].field).toBe(`Test__c.${deltaFieldName}`)
    expect(adminProfile.fieldPermissions[0].editable).toBe(true)
    expect(adminProfile.fieldPermissions[0].readable).toBe(true)
    expect(adminProfile.fieldPermissions[1].field).toBe(`Test__c.${addressFieldName}`)
    expect(adminProfile.fieldPermissions[1].editable).toBe(false)
    expect(adminProfile.fieldPermissions[1].readable).toBe(false)
    expect(adminProfile.fieldPermissions[2].field).toBe(`Test__c.${appleFieldName}`)
    expect(adminProfile.fieldPermissions[2].editable).toBe(false)
    expect(adminProfile.fieldPermissions[2].readable).toBe(false)
  })

  it('should set default field permissions upon add', async () => {
    const after = mockObject.clone()
    await filter().onAdd(after)

    const adminRef = new ReferenceExpression(
      mockAdmin.elemID
    )

    expect(after.fields[descriptionFieldName].annotations[FIELD_LEVEL_SECURITY_ANNOTATION])
      .toEqual({ editable: [adminRef], readable: [adminRef] })
    verifyUpdateCall(ADMIN_PROFILE, `Test__c.${descriptionFieldName}`)
  })

  it('should set default field permissions upon update', async () => {
    const before = mockObject.clone()
    const after = before.clone()
    after.fields = { ...after.fields, [appleFieldName]: apple.clone() }

    await filter().onUpdate(before, after,
      [{ action: 'add', data: { after: after.fields[appleFieldName] } }])

    expect(after.fields[appleFieldName].annotations[FIELD_LEVEL_SECURITY_ANNOTATION])
      .toEqual(admin[FIELD_LEVEL_SECURITY_ANNOTATION])
    verifyUpdateCall(ADMIN_PROFILE, `Test__c.${appleFieldName}`)
  })

  it('should not set permissions for required fields upon add', async () => {
    const after = mockObject.clone()
    Object.values(after.fields).forEach(f => {
      f.annotations[CORE_ANNOTATIONS.REQUIRED] = true
    })

    await filter().onAdd(after)

    expect(after.fields[descriptionFieldName].annotations)
      .not.toHaveProperty(FIELD_LEVEL_SECURITY_ANNOTATION)
    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const profile = mockUpdate.mock.calls[0][1][0]
    expect(profile.fieldPermissions).toHaveLength(0)
  })

  it('should not update required fields', async () => {
    const before = mockObject.clone()
    const after = before.clone()

    Object.assign(before.fields[descriptionFieldName].annotations, admin)
    after.fields[descriptionFieldName].annotations[CORE_ANNOTATIONS.REQUIRED] = true

    await filter().onUpdate(before, after, [
      { action: 'modify',
        data: {
          before: before.fields[descriptionFieldName],
          after: after.fields[descriptionFieldName],
        } },
    ])
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(after.fields[descriptionFieldName].annotations)
      .not.toHaveProperty(FIELD_LEVEL_SECURITY_ANNOTATION)
  })
})
