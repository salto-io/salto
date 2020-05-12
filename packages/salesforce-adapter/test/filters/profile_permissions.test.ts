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
  ObjectType, ElemID, Field, PrimitiveType, PrimitiveTypes, CORE_ANNOTATIONS, FieldMap,
} from '@salto-io/adapter-api'
import { ProfileInfo } from '../../src/client/types'
import filterCreator from '../../src/filters/profile_permissions'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { Types } from '../../src/transformers/transformer'

describe('Object Permissions filter', () => {
  const { client } = mockClient()
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  const descriptionFieldName = 'Description__c'
  const stringType = new PrimitiveType({
    elemID: new ElemID(constants.SALESFORCE, 'string'),
    primitive: PrimitiveTypes.STRING,
  })
  const mockObject = new ObjectType({
    elemID: mockElemID,
    annotations: {
      label: 'test label',
      [constants.API_NAME]: 'Test__c',
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    },
    fields: [
      {
        name: descriptionFieldName,
        type: stringType,
        annotations: { [constants.API_NAME]: `Test__c.${descriptionFieldName}` },
      },
    ],
  })

  let mockUpdate: jest.Mock

  type FilterType = FilterWith<'onFetch' | 'onAdd' | 'onUpdate'>
  const filter = (): FilterType => filterCreator({ client }) as FilterType

  const verifyUpdateCall = (objectName: string, fieldNames: string[],
    shouldUpdateObjectPermissions = true): void => {
    expect(mockUpdate.mock.calls.length).toBe(1)
    const profile = mockUpdate.mock.calls[0][1] as ProfileInfo
    expect(profile.fullName).toEqual(constants.ADMIN_PROFILE)
    expect(profile.objectPermissions).toHaveLength(shouldUpdateObjectPermissions ? 1 : 0)
    if (shouldUpdateObjectPermissions) {
      const [objectPermissions] = profile.objectPermissions
      expect(objectPermissions.object).toEqual(objectName)
      expect(objectPermissions.allowCreate).toBe(true)
      expect(objectPermissions.allowDelete).toBe(true)
      expect(objectPermissions.allowEdit).toBe(true)
      expect(objectPermissions.allowRead).toBe(true)
      expect(objectPermissions.modifyAllRecords).toBe(true)
      expect(objectPermissions.viewAllRecords).toBe(true)
    }
    expect(profile.fieldPermissions).toHaveLength(fieldNames.length)
    profile.fieldPermissions.forEach(fieldPermissions => {
      expect(fieldPermissions.readable).toBe(true)
      expect(fieldPermissions.editable).toBe(true)
    })
  }

  beforeEach(() => {
    mockUpdate = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
    client.update = mockUpdate
  })

  it('should update object permissions upon new salesforce type', async () => {
    const after = mockObject.clone()
    await filter().onAdd(after)

    verifyUpdateCall('Test__c', [`Test__c.${descriptionFieldName}`])
  })

  it('should only update new fields upon update', async () => {
    const createField = (obj: ObjectType, name: string): FieldMap => ({
      [name]: new Field(obj, name, stringType, { [constants.API_NAME]: `Test__c.${name}` }),
    })
    const addressFieldName = 'address__c'
    const bananaFieldName = 'banana__c'
    const appleFieldName = 'apple__c'
    const before = mockObject.clone()
    Object.assign(
      before.fields,
      createField(before, addressFieldName),
      createField(before, bananaFieldName),
    )

    const after = before.clone()
    Object.assign(
      after.fields,
      createField(after, appleFieldName),
    )
    await filter().onUpdate(before, after,
      [
        { action: 'add', data: { after: after.fields[appleFieldName] } },
        { action: 'modify',
          data: {
            before: before.fields[descriptionFieldName],
            after: after.fields[descriptionFieldName],
          } },
      ])

    verifyUpdateCall('Test__c', [`Test__c.${appleFieldName}`],
      false)
  })

  it('should not set permissions for required fields upon add', async () => {
    const after = mockObject.clone()
    Object.values(after.fields).forEach(f => {
      f.annotations[CORE_ANNOTATIONS.REQUIRED] = true
    })

    await filter().onAdd(after)

    verifyUpdateCall('Test__c', [], true)
  })

  it('should not set permissions for system fields upon add', async () => {
    const after = mockObject.clone()
    after.fields[descriptionFieldName].annotations[constants.API_NAME] = 'NotCustomField'

    await filter().onAdd(after)

    verifyUpdateCall('Test__c', [], true)
  })

  it('should not set permissions for master-detail fields upon add', async () => {
    const after = mockObject.clone()
    Object.values(after.fields).forEach(f => {
      f.type = Types.primitiveDataTypes.MasterDetail
    })

    await filter().onAdd(after)

    verifyUpdateCall('Test__c', [], true)
  })

  it('should not update required fields', async () => {
    const before = mockObject.clone()
    const after = before.clone()

    after.fields[descriptionFieldName].annotations[CORE_ANNOTATIONS.REQUIRED] = true

    await filter().onUpdate(before, after, [
      { action: 'modify',
        data: {
          before: before.fields[descriptionFieldName],
          after: after.fields[descriptionFieldName],
        } },
    ])
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should not update system fields', async () => {
    const before = mockObject.clone()
    const after = before.clone()

    after.fields[descriptionFieldName].annotations[constants.API_NAME] = 'NotCustomField'

    await filter().onUpdate(before, after, [
      { action: 'modify',
        data: {
          before: before.fields[descriptionFieldName],
          after: after.fields[descriptionFieldName],
        } },
    ])
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should not update master-detail fields', async () => {
    const before = mockObject.clone()
    const after = before.clone()

    after.fields[descriptionFieldName].type = Types.primitiveDataTypes.MasterDetail

    await filter().onUpdate(before, after, [
      { action: 'modify',
        data: {
          before: before.fields[descriptionFieldName],
          after: after.fields[descriptionFieldName],
        } },
    ])
    expect(mockUpdate).not.toHaveBeenCalled()
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
    const result = await filter().onAdd(after)

    expect(result[0].success).toBe(false)
  })
})
