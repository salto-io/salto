import {
  ObjectType, ElemID, Field, InstanceElement, isObjectType, BuiltinTypes,
  ReferenceExpression,
} from 'adapter-api'
import _ from 'lodash'
import { metadataType } from '../../src/transformers/transformer'
import { ObjectPermissions, ProfileInfo } from '../../src/client/types'
import filterCreator, { getProfileInstances } from '../../src/filters/profile_permissions'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

const { OBJECT_LEVEL_SECURITY_ANNOTATION, PROFILE_METADATA_TYPE, ADMIN_PROFILE } = constants
const { ALLOW_CREATE, ALLOW_DELETE, ALLOW_EDIT, ALLOW_READ,
  MODIFY_ALL_RECORDS, VIEW_ALL_RECORDS } = constants.OBJECT_LEVEL_SECURITY_FIELDS

describe('Object Permissions filter', () => {
  const { client } = mockClient()
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  const mockObject = new ObjectType({
    elemID: mockElemID,
    annotations: {
      label: 'test label',
      [constants.API_NAME]: 'Test__c',
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    },
  })
  const mockExtendObject = new ObjectType({
    elemID: mockElemID,
    annotations: {
      label: 'another test label',
      [constants.API_NAME]: 'Test_Extend__c',
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    },
  })

  const STANDARD_NAME = 'Standard'
  const admin = {
    [OBJECT_LEVEL_SECURITY_ANNOTATION]:
      { [ALLOW_CREATE]: [ADMIN_PROFILE],
        [ALLOW_DELETE]: [ADMIN_PROFILE],
        [ALLOW_EDIT]: [ADMIN_PROFILE],
        [ALLOW_READ]: [ADMIN_PROFILE],
        [MODIFY_ALL_RECORDS]: [ADMIN_PROFILE],
        [VIEW_ALL_RECORDS]: [ADMIN_PROFILE] },
  }
  const addStandard = (object: ObjectType): void =>
    object.annotations[OBJECT_LEVEL_SECURITY_ANNOTATION][ALLOW_READ].push(STANDARD_NAME)

  const mockProfileElemID = new ElemID(constants.SALESFORCE, PROFILE_METADATA_TYPE)
  const mockObjectPermissions = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'profile_object_level_security'),
    annotations: { [constants.METADATA_TYPE]: 'ProfileObjectLevelSecurity' },
  })
  const mockProfile = new ObjectType({
    elemID: mockProfileElemID,
    fields: {
      [constants.OBJECT_PERMISSIONS]: new Field(mockProfileElemID, 'object_permissions', mockObjectPermissions),
      [constants.INSTANCE_FULL_NAME_FIELD]:
        new Field(mockProfileElemID, constants.INSTANCE_FULL_NAME_FIELD, BuiltinTypes.SERVICE_ID),
    },
    annotationTypes: {},
    annotations: {
      [constants.METADATA_TYPE]: PROFILE_METADATA_TYPE,
      [constants.API_NAME]: 'Profile',
    },
  })
  const mockAdmin = new InstanceElement(
    ADMIN_PROFILE,
    mockProfile,
    {
      [constants.OBJECT_PERMISSIONS]: [
        {
          object: 'Test__c',
          [ALLOW_CREATE]: 'true',
          [ALLOW_DELETE]: 'true',
          [ALLOW_EDIT]: 'false',
          [ALLOW_READ]: 'true',
          [MODIFY_ALL_RECORDS]: 'true',
          [VIEW_ALL_RECORDS]: 'true',
        },
        {
          object: 'Test_Extend__c',
          [ALLOW_CREATE]: 'true',
          [ALLOW_DELETE]: 'false',
          [ALLOW_EDIT]: 'false',
          [ALLOW_READ]: 'false',
          [MODIFY_ALL_RECORDS]: 'false',
          [VIEW_ALL_RECORDS]: 'false',
        },
      ],
      description: 'Admin profile',
      [constants.INSTANCE_FULL_NAME_FIELD]: 'Admin',
    },
  )
  const mockStandard = new InstanceElement(
    STANDARD_NAME,
    mockProfile,
    {
      [constants.OBJECT_PERMISSIONS]: [
        {
          object: 'Test__c',
          [ALLOW_CREATE]: 'false',
          [ALLOW_DELETE]: 'false',
          [ALLOW_EDIT]: 'true',
          [ALLOW_READ]: 'false',
          [MODIFY_ALL_RECORDS]: 'false',
          [VIEW_ALL_RECORDS]: 'false',
        },
      ],
      description: 'Standard profile',
      [constants.INSTANCE_FULL_NAME_FIELD]: 'Standard',
    },
  )
  const adminRef = new ReferenceExpression(
    mockAdmin.elemID
  )
  const standardRef = new ReferenceExpression(
    mockStandard.elemID
  )

  let mockUpdate: jest.Mock

  type FilterType = FilterWith<'onFetch' | 'onAdd' | 'onUpdate'>
  const filter = (): FilterType => filterCreator({ client }) as FilterType

  const verifyUpdateCall = (profileName: string, objectName: string, allowCreate = true,
    allowDelete = true, allowEdit = true, allowRead = true, modifyAllRecords = true,
    viewAllRecords = true): void => {
    expect(mockUpdate.mock.calls.length).toBe(1)
    const profiles = mockUpdate.mock.calls[0][1] as ProfileInfo[]
    const profile = profiles.find(p => p.fullName === profileName) as ProfileInfo
    const objectPermissions = profile.objectPermissions
      .find(o => o.object === objectName) as ObjectPermissions
    expect(objectPermissions.allowCreate).toBe(allowCreate)
    expect(objectPermissions.allowDelete).toBe(allowDelete)
    expect(objectPermissions.allowEdit).toBe(allowEdit)
    expect(objectPermissions.allowRead).toBe(allowRead)
    expect(objectPermissions.modifyAllRecords).toBe(modifyAllRecords)
    expect(objectPermissions.viewAllRecords).toBe(viewAllRecords)
  }

  beforeEach(() => {
    mockUpdate = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
    client.update = mockUpdate
  })
  it('should add object_level_security to object types and remove it from profile type & instances',
    async () => {
      const elements = [mockObject.clone(), mockExtendObject.clone(), mockAdmin, mockStandard,
        mockProfile]
      await filter().onFetch(elements)
      const objectTypes = elements.filter(isObjectType)

      // Check mockObject has the right permissions
      const objectLevelSecurity = objectTypes[0]
        .annotations[OBJECT_LEVEL_SECURITY_ANNOTATION]
      expect(objectLevelSecurity[ALLOW_CREATE]).toEqual([adminRef])
      expect(objectLevelSecurity[ALLOW_DELETE]).toEqual([adminRef])
      expect(objectLevelSecurity[ALLOW_EDIT]).toEqual([standardRef])
      expect(objectLevelSecurity[ALLOW_READ]).toEqual([adminRef])
      expect(objectLevelSecurity[MODIFY_ALL_RECORDS]).toEqual([adminRef])
      expect(objectLevelSecurity[VIEW_ALL_RECORDS]).toEqual([adminRef])

      const objectLevelSecurityExtend = objectTypes[1]
        .annotations[OBJECT_LEVEL_SECURITY_ANNOTATION]
      expect(objectLevelSecurityExtend[ALLOW_CREATE]).toEqual([adminRef])
      expect(objectLevelSecurityExtend[ALLOW_DELETE]).toEqual([])
      expect(objectLevelSecurityExtend[ALLOW_EDIT]).toEqual([])
      expect(objectLevelSecurityExtend[ALLOW_READ]).toEqual([])
      expect(objectLevelSecurityExtend[MODIFY_ALL_RECORDS]).toEqual([])
      expect(objectLevelSecurityExtend[VIEW_ALL_RECORDS]).toEqual([])

      // Check profile instances' object_permissions were deleted
      getProfileInstances(elements)
        .forEach(profileInstance => expect(profileInstance.value[constants.OBJECT_PERMISSIONS])
          .toBeUndefined())

      // Check Profile type's object_permissions field was deleted
      const profileType = elements.filter(isObjectType)
        .filter(elem => metadataType(elem) === PROFILE_METADATA_TYPE)[0]
      expect(profileType).toBeDefined()
      expect(profileType.fields[constants.OBJECT_PERMISSIONS]).toBeUndefined()
    })

  it('should set default object permissions upon add', async () => {
    const after = mockObject.clone()
    await filter().onAdd(after)

    expect(after.annotations[OBJECT_LEVEL_SECURITY_ANNOTATION])
      .toEqual({ [ALLOW_CREATE]: [adminRef],
        [ALLOW_DELETE]: [adminRef],
        [ALLOW_EDIT]: [adminRef],
        [ALLOW_READ]: [adminRef],
        [MODIFY_ALL_RECORDS]: [adminRef],
        [VIEW_ALL_RECORDS]: [adminRef] })
    verifyUpdateCall(ADMIN_PROFILE, 'Test__c')
  })

  it('should update object permissions upon new salesforce type', async () => {
    const after = mockObject.clone()
    _.merge(after.annotations, admin)
    addStandard(after)

    await filter().onAdd(after)

    // Verify permissions creation
    verifyUpdateCall(ADMIN_PROFILE, 'Test__c', true, true, true, true, true, true)
    verifyUpdateCall(STANDARD_NAME, 'Test__c', false, false, false, true, false, false)
  })

  it('should fail object permissions filter add due to sfdc error', async () => {
    client.update = jest.fn().mockImplementation(() => ([{
      success: false,
      errors: [
        {
          message: 'Failed to update profile',
        },
      ],
    }]))
    const after = mockObject.clone()
    _.merge(after.annotations, admin)
    const result = await filter().onAdd(after)

    expect(result[0].success).toBe(false)
  })

  it('should update object permissions upon modification - add', async () => {
    const before = mockObject.clone()
    const after = before.clone()
    _.merge(after.annotations, admin)
    addStandard(after)

    await filter().onUpdate(before, after,
      [{ action: 'modify', data: { before, after } }])

    expect(after.annotations[OBJECT_LEVEL_SECURITY_ANNOTATION])
      .toEqual({ [ALLOW_CREATE]: [ADMIN_PROFILE],
        [ALLOW_DELETE]: [ADMIN_PROFILE],
        [ALLOW_EDIT]: [ADMIN_PROFILE],
        [ALLOW_READ]: [ADMIN_PROFILE, STANDARD_NAME],
        [MODIFY_ALL_RECORDS]: [ADMIN_PROFILE],
        [VIEW_ALL_RECORDS]: [ADMIN_PROFILE] })
    verifyUpdateCall(ADMIN_PROFILE, 'Test__c')
    verifyUpdateCall(STANDARD_NAME, 'Test__c', false, false, false, true, false, false)
  })

  it('should update object permissions upon modification - remove', async () => {
    const before = mockObject.clone()
    const after = before.clone()
    _.merge(after.annotations, admin)
    _.merge(before.annotations, admin)
    addStandard(before)

    await filter().onUpdate(before, after,
      [{ action: 'modify', data: { before, after } }])

    expect(after.annotations[OBJECT_LEVEL_SECURITY_ANNOTATION])
      .toEqual(admin[OBJECT_LEVEL_SECURITY_ANNOTATION])
    verifyUpdateCall(STANDARD_NAME, 'Test__c', false, false, false, false, false, false)
  })
})
