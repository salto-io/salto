import {
  ObjectType, ElemID, PrimitiveType, Field, PrimitiveTypes,
  InstanceElement, isObjectType, isInstanceElement,
} from 'adapter-api'
import _ from 'lodash'
import { metadataType, Types } from '../../src/transformer'
import { ProfileInfo, FieldPermissions } from '../../src/client/types'
import filterCreator, {
  FIELD_LEVEL_SECURITY_ANNOTATION, PROFILE_METADATA_TYPE, ADMIN_PROFILE,
} from '../../src/filters/field_permissions'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('Field Permissions filter', () => {
  const { client } = mockClient()
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  const stringType = new PrimitiveType({
    elemID: new ElemID(constants.SALESFORCE, 'string'),
    primitive: PrimitiveTypes.STRING,
  })
  const mockObject = new ObjectType({
    elemID: mockElemID,
    fields: {
      description:
        new Field(mockElemID, 'description', stringType,
          { [constants.API_NAME]: 'Description__c' }),
      master:
        new Field(mockElemID, 'master', Types.primitiveDataTypes.masterdetail,
          { [constants.API_NAME]: 'Master__c' }),
    },
    annotations: {
      label: 'test label',
      [constants.API_NAME]: 'Test__c',
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    },
  })
  const mockExtendedObject = new ObjectType({
    elemID: mockElemID,
    fields: {
      plus:
        new Field(mockElemID, 'plus', stringType,
          { [constants.API_NAME]: 'Plus__c' }),
    },
  })
  const admin = {
    [FIELD_LEVEL_SECURITY_ANNOTATION]: { admin: { editable: true, readable: true } },
  }
  const standard = {
    [FIELD_LEVEL_SECURITY_ANNOTATION]: { standard: { editable: false, readable: true } },
  }
  const mockProfileElemID = new ElemID(constants.SALESFORCE, 'profile')
  const mockFieldPermissions = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'profile_field_level_security'),
    fields: {},
    annotations: { [constants.METADATA_TYPE]: 'ProfileFieldLevelSecurity' },
  })
  const mockProfile = new ObjectType({
    elemID: mockProfileElemID,
    fields: {
      [constants.FIELD_PERMISSIONS]: new Field(mockProfileElemID, 'field_permissions', mockFieldPermissions),
    },
    annotationTypes: {},
    annotations: {
      [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
      [constants.API_NAME]: 'Profile',
    },
  })
  const mockAdminElemID = new ElemID(constants.SALESFORCE, 'admin')
  const mockAdmin = new InstanceElement(mockAdminElemID,
    mockProfile,
    {
      [constants.FIELD_PERMISSIONS]: [
        {
          field: 'Test__c.Description__c',
          readable: true,
          editable: false,
        },
        {
          field: 'Test__c.Plus__c',
          readable: true,
          editable: false,
        },
      ],
      description: 'Admin profile',
    })
  const mockStandardID = new ElemID(constants.SALESFORCE, 'standard')
  const mockStandard = new InstanceElement(mockStandardID,
    mockProfile,
    {
      [constants.FIELD_PERMISSIONS]: [
        {
          field: 'Test__c.Description__c',
          readable: false,
          editable: true,
        },
      ],
      description: 'Standard profile',
    })
  const mockNoFieldPermissionsID = new ElemID(constants.SALESFORCE, 'fake_no_field_permissions')
  const mockNoFieldPerm = new InstanceElement(mockNoFieldPermissionsID,
    mockProfile,
    {
      description: 'Profile with no field_permissions',
    })
  const address = new Field(mockElemID, 'address', stringType, _.merge({},
    { ...admin, [constants.API_NAME]: 'Address__c' }))
  const banana = new Field(mockElemID, 'banana', stringType, _.merge({},
    { ...admin, [constants.API_NAME]: 'Banana__c' }))
  const apple = new Field(mockElemID, 'apple', stringType, _.merge({},
    { ...admin, [constants.API_NAME]: 'Apple__c' }))
  const delta = new Field(mockElemID, 'delta', stringType, _.merge(_.merge({},
    { ...admin, [constants.API_NAME]: 'Delta__c' }), standard))

  let mockUpdate: jest.Mock<unknown>

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
      const fieldLevelSecurity = objectTypes[0].fields.description
        .annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
      expect(fieldLevelSecurity.admin.readable).toBe(true)
      expect(fieldLevelSecurity.admin.editable).toBe(false)
      expect(fieldLevelSecurity.standard.readable).toBe(false)
      expect(fieldLevelSecurity.standard.editable).toBe(true)
      expect(fieldLevelSecurity.fake_no_field_permissions).toBeUndefined()

      const fieldLevelSecurityPlus = objectTypes[1].fields.plus
        .annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
      expect(fieldLevelSecurityPlus.admin.readable).toBe(true)
      expect(fieldLevelSecurityPlus.admin.editable).toBe(false)

      // Check profile instances' field_permissions were deleted
      elements.filter(isInstanceElement)
        .filter(elem => metadataType(elem) === PROFILE_METADATA_TYPE)
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
    _.merge(after.fields.description.annotations, admin)
    _.merge(after.fields.description.annotations, standard)
    await filter().onAdd(after)

    // Verify permissions creation
    verifyUpdateCall('Admin', 'Test__c.Description__c')
    verifyUpdateCall('Standard', 'Test__c.Description__c', false, true)
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
    _.merge(after.fields.description.annotations, admin)
    const result = await filter().onAdd(after)

    expect(result[0].success).toBe(false)
  })

  it('should only update new fields and new permissions upon update', async () => {
    const before = mockObject.clone()
    before.fields = { ...before.fields, address, banana }

    const after = before.clone()
    // Add apple field
    after.fields = { ...after.fields, apple }
    // Add permissions to existing field
    _.merge(after.fields.description.annotations, admin)
    await filter().onUpdate(before, after,
      [
        { action: 'add', data: { after: apple } },
        { action: 'modify',
          data: { before: before.fields.description, after: after.fields.description } },
      ])

    // Verify the field permissions update
    verifyUpdateCall('Admin', 'Test__c.Description__c')
    verifyUpdateCall('Admin', 'Test__c.Apple__c')
  })

  it('should update field permissions upon update that include add and remove of fields',
    async () => {
      const before = mockObject.clone()
      before.fields = { address, banana }

      // After - banana was removed and apple was added
      const after = mockObject.clone()
      after.fields = { address, apple }

      await filter().onUpdate(before, after, [
        { action: 'add', data: { after: apple } },
        { action: 'remove', data: { before: banana } },
      ])

      // Verify the field permissions update
      verifyUpdateCall('Admin', 'Test__c.Apple__c')
    })

  it('should update the new profile on existing field', async () => {
    const before = mockObject.clone()
    before.fields = { ...before.fields, address }
    const after = before.clone()
    // Add admin permissions with editable=false for description field
    _.merge(after.fields.description.annotations, admin)
    after.fields.description.annotations[FIELD_LEVEL_SECURITY_ANNOTATION]
      .admin.editable = false
    // Add standard profile field permissions to address
    _.merge(after.fields.address.annotations, standard)

    await filter().onUpdate(before, after, [
      { action: 'modify',
        data: { before: before.fields.description,
          after: after.fields.description } },
      { action: 'modify',
        data: { before: before.fields.address,
          after: after.fields.address } },
    ])

    // Verify the field permissions creation
    verifyUpdateCall('Admin', 'Test__c.Description__c', false, true)
    verifyUpdateCall('Standard', 'Test__c.Address__c', false, true)
  })

  it('should properly update the remaining fields permissions of the object', async () => {
    const before = mockObject.clone()
    before.fields = { address: address.clone(), banana, apple }
    // Add standard to address field (on top of admin)
    _.merge(before.fields.address.annotations, standard)
    // Banana field will have only standard permissions
    before.fields.banana.annotations = {
      [constants.API_NAME]: before.fields.banana.annotations[constants.API_NAME],
      ...standard,
    }

    // after we have address with only standard and delta that has both admin and standard
    const after = mockObject.clone()
    after.fields = { address, delta, apple: apple.clone() }
    // Remove admin permissions from address field
    after.fields.address.annotations = {
      [constants.API_NAME]: before.fields.address.annotations[constants.API_NAME],
      ...standard,
    }
    // Apple has no field permissions as all
    after.fields.apple.annotations = {
      [constants.API_NAME]: after.fields.apple.annotations[constants.API_NAME],
    }
    await filter().onUpdate(before, after, [
      { action: 'modify', data: { before: before.fields.address, after: after.fields.address } },
      { action: 'remove', data: { before: before.fields.banana } },
      { action: 'modify', data: { before: before.fields.apple, after: after.fields.apple } },
      { action: 'add', data: { after: after.fields.delta } },
    ])

    // Verify the field permissions change
    verifyUpdateCall('Standard', 'Test__c.Delta__c', false, true)

    // Banana field was removed so no need to explicitly remove from profile
    const adminProfile = mockUpdate.mock.calls[0][1][1]
    expect(adminProfile.fullName).toBe('Admin')
    expect(adminProfile.fieldPermissions.length).toBe(3)
    expect(adminProfile.fieldPermissions[0].field).toBe('Test__c.Address__c')
    expect(adminProfile.fieldPermissions[0].editable).toBe(false)
    expect(adminProfile.fieldPermissions[0].readable).toBe(false)
    expect(adminProfile.fieldPermissions[1].field).toBe('Test__c.Delta__c')
    expect(adminProfile.fieldPermissions[1].editable).toBe(true)
    expect(adminProfile.fieldPermissions[1].readable).toBe(true)
    expect(adminProfile.fieldPermissions[2].field).toBe('Test__c.Apple__c')
    expect(adminProfile.fieldPermissions[2].editable).toBe(false)
    expect(adminProfile.fieldPermissions[2].readable).toBe(false)
  })

  it('should set default field permissions upon add', async () => {
    const after = mockObject.clone()
    await filter().onAdd(after)

    expect(after.fields.description.annotations[FIELD_LEVEL_SECURITY_ANNOTATION])
      .toEqual({ [ADMIN_PROFILE]: { editable: true, readable: true } })
    expect(after.fields.master.annotations[FIELD_LEVEL_SECURITY_ANNOTATION])
      .toBeUndefined()
    verifyUpdateCall('Admin', 'Test__c.Description__c')
  })

  it('should set default field permissions upon update', async () => {
    const before = mockObject.clone()
    const after = before.clone()
    after.fields = { ...after.fields, apple: apple.clone() }

    await filter().onUpdate(before, after,
      [{ action: 'add', data: { after: after.fields.apple } }])

    expect(after.fields.apple.annotations[FIELD_LEVEL_SECURITY_ANNOTATION])
      .toEqual({ [ADMIN_PROFILE]: { editable: true, readable: true } })
    verifyUpdateCall('Admin', 'Test__c.Apple__c')
  })
})
