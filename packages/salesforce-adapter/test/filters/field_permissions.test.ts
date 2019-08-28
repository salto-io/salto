import {
  ObjectType, ElemID, PrimitiveType, Field, PrimitiveTypes,
} from 'adapter-api'
import _ from 'lodash'
import { ProfileInfo } from '../../src/client/types'
import {
  filter as makeFilter, FIELD_LEVEL_SECURITY_ANNOTATION,
} from '../../src/filters/field_permissions'
import SalesforceClient from '../../src/client/client'
import * as constants from '../../src/constants'
import { FilterInstanceWith } from '../../src/filter'

jest.mock('../../src/client/client')

describe('Test Field Permissions filter', () => {
  const client = (): SalesforceClient => new SalesforceClient('', '', false)
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
    },
    annotationsValues: {
      label: 'test label',
      [constants.API_NAME]: 'Test__c',
    },
  })
  const admin = {
    [FIELD_LEVEL_SECURITY_ANNOTATION]: { admin: { editable: true, readable: true } },
  }
  const standard = {
    [FIELD_LEVEL_SECURITY_ANNOTATION]: { standard: { editable: false, readable: true } },
  }
  const address = new Field(mockElemID, 'address', stringType, _.merge({},
    { ...admin, [constants.API_NAME]: 'Address__c' }))
  const banana = new Field(mockElemID, 'banana', stringType, _.merge({},
    { ...admin, [constants.API_NAME]: 'Banana__c' }))
  const apple = new Field(mockElemID, 'apple', stringType, _.merge({},
    { ...admin, [constants.API_NAME]: 'Apple__c' }))
  const delta = new Field(mockElemID, 'delta', stringType, _.merge(_.merge({},
    { ...admin, [constants.API_NAME]: 'Delta__c' }), standard))

  let mockUpdate: jest.Mock<unknown>

  type FilterType = FilterInstanceWith<'onDiscover' | 'onAdd' | 'onUpdate'>
  const filter = (): FilterType => makeFilter(client()) as FilterType

  beforeEach(() => {
    mockUpdate = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
    SalesforceClient.prototype.update = mockUpdate
  })

  it('should discover sobject permissions', async () => {
    SalesforceClient.prototype.listMetadataObjects = jest.fn().mockImplementation(() => [
      { fullName: 'Admin' }])
    SalesforceClient.prototype.readMetadata = jest.fn().mockImplementation(() => ([{
      fullName: 'Admin',
      fieldPermissions: [
        {
          field: 'Test__c.Description__c',
          readable: true,
          editable: false,
        },
      ],
    }]))
    const elements = [mockObject.clone()]

    await filter().onDiscover(elements)
    const security = elements[0].fields.description.getAnnotationsValues()[
      FIELD_LEVEL_SECURITY_ANNOTATION]
    expect(security.admin.readable).toBe(true)
    expect(security.admin.editable).toBe(false)
  })
  it('should update field permissions upon new salesforce type', async () => {
    const after = mockObject.clone()
    _.merge(after.fields.description.getAnnotationsValues(), admin)
    _.merge(after.fields.description.getAnnotationsValues(), standard)
    await filter().onAdd(after)

    // Verify permissions creation
    expect(mockUpdate.mock.calls.length).toBe(1)
    const profiles = mockUpdate.mock.calls[0][1] as ProfileInfo[]
    const adminProfile = profiles.filter(p => p.fullName === 'Admin').pop() as ProfileInfo
    expect(adminProfile.fieldPermissions.length).toBe(1)
    expect(adminProfile.fieldPermissions[0].field).toBe('Test__c.Description__c')
    expect(adminProfile.fieldPermissions[0].editable).toBe(true)
    expect(adminProfile.fieldPermissions[0].readable).toBe(true)
    const standardProfile = profiles.filter(p => p.fullName === 'Standard').pop() as ProfileInfo
    expect(standardProfile.fieldPermissions.length).toBe(1)
    expect(standardProfile.fieldPermissions[0].field).toBe('Test__c.Description__c')
    expect(standardProfile.fieldPermissions[0].editable).toBe(false)
    expect(standardProfile.fieldPermissions[0].readable).toBe(true)
  })

  it('should fail field permissions filter add due to sfdc error', async () => {
    SalesforceClient.prototype.update = jest.fn().mockImplementationOnce(() => ([{
      success: false,
      errors: [
        {
          message: 'Failed to update profile',
        },
      ],
    }]))
    const after = mockObject.clone()
    _.merge(after.fields.description.getAnnotationsValues(), admin)
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
    _.merge(after.fields.description.getAnnotationsValues(), admin)
    await filter().onUpdate(before, after)

    expect(mockUpdate.mock.calls.length).toBe(1)
    // Verify the field permissions update
    const profileInfo = mockUpdate.mock.calls[0][1][0]
    expect(profileInfo.fullName).toBe('Admin')
    expect(profileInfo.fieldPermissions.length).toBe(2)
    expect(profileInfo.fieldPermissions[0].field).toBe('Test__c.Description__c')
    expect(profileInfo.fieldPermissions[0].editable).toBe(true)
    expect(profileInfo.fieldPermissions[0].readable).toBe(true)
    expect(profileInfo.fieldPermissions[1].field).toBe('Test__c.Apple__c')
  })

  it('should update field permissions upon update that include add and remove of fields',
    async () => {
      const before = mockObject.clone()
      before.fields = { address, banana }

      // After - banana was removed and apple was added
      const after = mockObject.clone()
      after.fields = { address, apple }

      await filter().onUpdate(before, after)

      expect(mockUpdate.mock.calls.length).toBe(1)
      // Verify the field permissions update
      const profileInfo = mockUpdate.mock.calls[0][1][0]
      expect(profileInfo.fullName).toBe('Admin')
      expect(profileInfo.fieldPermissions.length).toBe(1)
      expect(profileInfo.fieldPermissions[0].field).toBe('Test__c.Apple__c')
      expect(profileInfo.fieldPermissions[0].editable).toBe(true)
      expect(profileInfo.fieldPermissions[0].readable).toBe(true)
    })
  it('should update the new profile on existing field', async () => {
    const before = mockObject.clone()
    before.fields = { ...before.fields, address }
    const after = before.clone()
    // Add admin permissions with editable=false for description field
    _.merge(after.fields.description.getAnnotationsValues(), admin)
    after.fields.description.getAnnotationsValues()[FIELD_LEVEL_SECURITY_ANNOTATION]
      .admin.editable = false
    // Add standard profile field permissions to address
    _.merge(after.fields.address.getAnnotationsValues(), standard)

    await filter().onUpdate(before, after)

    // Verify the field permissions creation
    const newProfileInfo = mockUpdate.mock.calls[0][1][0]
    expect(newProfileInfo.fullName).toBe('Admin')
    expect(newProfileInfo.fieldPermissions.length).toBe(1)
    expect(newProfileInfo.fieldPermissions[0].field).toBe('Test__c.Description__c')
    expect(newProfileInfo.fieldPermissions[0].editable).toBe(false)
    expect(newProfileInfo.fieldPermissions[0].readable).toBe(true)
    // Verify the field permissions change
    const changedProfileInfo = mockUpdate.mock.calls[0][1][1]
    expect(changedProfileInfo.fullName).toBe('Standard')
    expect(changedProfileInfo.fieldPermissions.length).toBe(1)
    expect(changedProfileInfo.fieldPermissions[0].field).toBe('Test__c.Address__c')
    expect(changedProfileInfo.fieldPermissions[0].editable).toBe(false)
    expect(changedProfileInfo.fieldPermissions[0].readable).toBe(true)
  })
  it("should properly update the remaining fields' permissions of the object", async () => {
    const before = mockObject.clone()
    before.fields = { address: address.clone(), banana, apple }
    // Add standard to address field (on top of admin)
    _.merge(before.fields.address.getAnnotationsValues(), standard)
    // Banana field will have only standard permissions
    before.fields.banana.setAnnotationsValues({
      [constants.API_NAME]: before.fields.banana.getAnnotationsValues()[constants.API_NAME],
      ...standard,
    })

    // after we have address with only standard and delta that has both admin and standard
    const after = mockObject.clone()
    after.fields = { address, delta, apple: apple.clone() }
    // Remove admin permissions from address field
    after.fields.address.setAnnotationsValues({
      [constants.API_NAME]: before.fields.address.getAnnotationsValues()[constants.API_NAME],
      ...standard,
    })
    // Apple has no field permissions as all
    after.fields.apple.setAnnotationsValues({
      [constants.API_NAME]: after.fields.apple.getAnnotationsValues()[constants.API_NAME],
    })
    await filter().onUpdate(before, after)

    expect(mockUpdate.mock.calls.length).toBe(1)
    // Verify the field permissions change
    const updatedProfileInfo = mockUpdate.mock.calls[0][1]
    expect(updatedProfileInfo[0].fullName).toBe('Standard')
    expect(updatedProfileInfo[0].fieldPermissions.length).toBe(1)
    expect(updatedProfileInfo[0].fieldPermissions[0].field).toBe('Test__c.Delta__c')
    expect(updatedProfileInfo[0].fieldPermissions[0].editable).toBe(false)
    expect(updatedProfileInfo[0].fieldPermissions[0].readable).toBe(true)
    // Banana field was removed so no need to explicitly remove from profile
    expect(updatedProfileInfo[1].fullName).toBe('Admin')
    expect(updatedProfileInfo[1].fieldPermissions.length).toBe(3)
    expect(updatedProfileInfo[1].fieldPermissions[0].field).toBe('Test__c.Address__c')
    expect(updatedProfileInfo[1].fieldPermissions[0].editable).toBe(false)
    expect(updatedProfileInfo[1].fieldPermissions[0].readable).toBe(false)
    expect(updatedProfileInfo[1].fieldPermissions[1].field).toBe('Test__c.Delta__c')
    expect(updatedProfileInfo[1].fieldPermissions[1].editable).toBe(true)
    expect(updatedProfileInfo[1].fieldPermissions[1].readable).toBe(true)
    expect(updatedProfileInfo[1].fieldPermissions[2].field).toBe('Test__c.Apple__c')
    expect(updatedProfileInfo[1].fieldPermissions[2].editable).toBe(false)
    expect(updatedProfileInfo[1].fieldPermissions[2].readable).toBe(false)
  })
})
