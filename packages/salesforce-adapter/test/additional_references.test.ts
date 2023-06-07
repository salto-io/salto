/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, SALESFORCE } from '../src/constants'
import { getAdditionalReferences } from '../src/additional_references'

describe('getAdditionalReferences', () => {
  let permissionSetInstance: InstanceElement
  let profileInstance: InstanceElement
  let field: Field

  beforeEach(() => {
    permissionSetInstance = new InstanceElement(
      'test',
      new ObjectType({ elemID: new ElemID(SALESFORCE, 'PermissionSet') }),
      {
        fieldPermissions: {
          Account: {
            testField__c: 'ReadWrite',
          },
        },
      }
    )

    profileInstance = new InstanceElement(
      'test',
      new ObjectType({ elemID: new ElemID(SALESFORCE, 'Profile') }),
      {
        fieldPermissions: {
          Account: {
            testField__c: 'ReadWrite',
          },
        },
      }
    )

    field = new Field(
      new ObjectType({
        elemID: new ElemID(SALESFORCE, 'Account'),
        annotations: { [METADATA_TYPE]: CUSTOM_OBJECT, [API_NAME]: 'Account' },
      }),
      'testField__c',
      BuiltinTypes.STRING,
      {
        [API_NAME]: 'Account.testField__c',
      }
    )
  })

  it('should create references from field to profile and permission sets', async () => {
    const refs = await getAdditionalReferences([
      toChange({ before: permissionSetInstance, after: permissionSetInstance }),
      toChange({ before: profileInstance, after: profileInstance }),
      toChange({ after: field }),
    ])

    expect(refs).toEqual([
      { source: field.elemID, target: permissionSetInstance.elemID.createNestedID('fieldPermissions', 'Account', 'testField__c') },
      { source: field.elemID, target: profileInstance.elemID.createNestedID('fieldPermissions', 'Account', 'testField__c') },
    ])
  })

  it('should add references only for addition fields', async () => {
    const refs = await getAdditionalReferences([
      toChange({ before: permissionSetInstance, after: permissionSetInstance }),
      toChange({ before: profileInstance, after: profileInstance }),
      toChange({ before: field, after: field }),
    ])

    expect(refs).toEqual([])
  })

  it('should not add references for addition profiles and permission sets', async () => {
    const refs = await getAdditionalReferences([
      toChange({ after: permissionSetInstance }),
      toChange({ after: profileInstance }),
      toChange({ after: field }),
    ])

    expect(refs).toEqual([])
  })

  it('should not add references if not contained the field section', async () => {
    delete permissionSetInstance.value.fieldPermissions.Account.testField__c
    delete profileInstance.value.fieldPermissions.Account.testField__c
    const refs = await getAdditionalReferences([
      toChange({ before: permissionSetInstance, after: permissionSetInstance }),
      toChange({ before: profileInstance, after: profileInstance }),
      toChange({ after: field }),
    ])

    expect(refs).toEqual([])
  })

  it('should not add references if field does not have an api name', async () => {
    delete field.annotations[API_NAME]
    const refs = await getAdditionalReferences([
      toChange({ before: permissionSetInstance, after: permissionSetInstance }),
      toChange({ before: profileInstance, after: profileInstance }),
      toChange({ after: field }),
    ])

    expect(refs).toEqual([])
  })
})
