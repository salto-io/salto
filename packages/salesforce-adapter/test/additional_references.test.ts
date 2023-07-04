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
import {
  BuiltinTypes,
  Change,
  Field,
  InstanceElement,
  ObjectType,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import {
  API_NAME,
  INSTANCE_FULL_NAME_FIELD,
} from '../src/constants'
import { getAdditionalReferences } from '../src/additional_references'
import { mockTypes } from './mock_elements'
import {
  createCustomObjectType,
  createMetadataTypeElement,
} from './utils'

describe('getAdditionalReferences', () => {
  const createTestInstances = (fields: Values): [InstanceElement, InstanceElement] => [
    new InstanceElement('test', mockTypes.Profile, fields),
    new InstanceElement('test', mockTypes.PermissionSet, fields),
  ]

  describe('fields', () => {
    let permissionSetInstance: InstanceElement
    let profileInstance: InstanceElement
    let field: Field

    beforeEach(() => {
      [permissionSetInstance, profileInstance] = createTestInstances({
        fieldPermissions: {
          Account: {
            testField__c: 'ReadWrite',
          },
        },
      })

      field = new Field(
        mockTypes.Account,
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
        { source: permissionSetInstance.elemID.createNestedID('fieldPermissions', 'Account', 'testField__c'), target: field.elemID },
        { source: profileInstance.elemID.createNestedID('fieldPermissions', 'Account', 'testField__c'), target: field.elemID },
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
  describe('custom apps', () => {
    let permissionSetInstance: InstanceElement
    let profileInstance: InstanceElement
    let customApp: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      [profileInstance, permissionSetInstance] = createTestInstances({
        applicationVisibilities: {
          SomeApplication: {
            application: 'SomeApplication',
            default: false,
            visible: false,
          },
        },
      })
      customApp = new InstanceElement(
        'SomeApplication',
        createMetadataTypeElement('CustomApplication', {}),
        { [INSTANCE_FULL_NAME_FIELD]: 'SomeApplication' },
      )
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: customApp }),
      ]
    })

    it('should create a reference', async () => {
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication', 'application'), target: customApp.elemID },
        { source: profileInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication', 'application'), target: customApp.elemID },
      ])
    })
  })
  describe('apex classes', () => {
    let permissionSetInstance: InstanceElement
    let profileInstance: InstanceElement
    let apexClass: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      [profileInstance, permissionSetInstance] = createTestInstances({
        classAccesses: {
          SomeApexClass: {
            apexClass: 'SomeApexClass',
            enabled: false,
          },
        },
      })
      apexClass = new InstanceElement(
        'SomeApexClass',
        mockTypes.ApexClass,
        { [INSTANCE_FULL_NAME_FIELD]: 'SomeApexClass' },
      )
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: apexClass }),
      ]
    })

    it('should create a reference', async () => {
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('classAccesses', 'SomeApexClass', 'apexClass'), target: apexClass.elemID },
        { source: profileInstance.elemID.createNestedID('classAccesses', 'SomeApexClass', 'apexClass'), target: apexClass.elemID },
      ])
    })
  })
  describe('flows', () => {
    let permissionSetInstance: InstanceElement
    let profileInstance: InstanceElement
    let flow: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      [profileInstance, permissionSetInstance] = createTestInstances({
        flowAccesses: {
          SomeFlow: {
            enabled: false,
            flow: 'SomeFlow',
          },
        },
      })
      flow = new InstanceElement(
        'SomeFlow',
        mockTypes.Flow,
        { [INSTANCE_FULL_NAME_FIELD]: 'SomeFlow' },
      )
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: flow }),
      ]
    })

    it('should create a reference', async () => {
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('flowAccesses', 'SomeFlow', 'flow'), target: flow.elemID },
        { source: profileInstance.elemID.createNestedID('flowAccesses', 'SomeFlow', 'flow'), target: flow.elemID },
      ])
    })
  })
  describe('layouts', () => {
    let permissionSetInstance: InstanceElement
    let profileInstance: InstanceElement
    let layout: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      [profileInstance, permissionSetInstance] = createTestInstances({
        layoutAssignments: {
          Account_Account_Layout: [
            {
              layout: 'Account_Account_Layout',
            },
          ],
        },
      })
      layout = new InstanceElement(
        'Account_Account_Layout',
        mockTypes.Layout,
        { [INSTANCE_FULL_NAME_FIELD]: 'Account_Account_Layout' },
      )
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: layout }),
      ]
    })

    it('should create a reference', async () => {
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout', '[0]', 'layout'), target: layout.elemID },
        { source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout', '[0]', 'layout'), target: layout.elemID },
      ])
    })
  })

  describe('objects', () => {
    let permissionSetInstance: InstanceElement
    let profileInstance: InstanceElement
    let customObject: ObjectType
    let changes: Change[]

    beforeEach(() => {
      [profileInstance, permissionSetInstance] = createTestInstances({
        objectPermissions: {
          Account: {
            allowCreate: true,
            allowDelete: true,
            allowEdit: true,
            allowRead: true,
            modifyAllRecords: false,
            object: 'Account',
            viewAllRecords: false,
          },
        },
      })
      customObject = createCustomObjectType('Account', {})
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: customObject }),
      ]
    })

    it('should create a reference', async () => {
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('objectPermissions', 'Account', 'object'), target: customObject.elemID },
        { source: profileInstance.elemID.createNestedID('objectPermissions', 'Account', 'object'), target: customObject.elemID },
      ])
    })
  })

  describe('Apex pages', () => {
    let permissionSetInstance: InstanceElement
    let profileInstance: InstanceElement
    let apexPage: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      [profileInstance, permissionSetInstance] = createTestInstances({
        pageAccesses: {
          SomeApexPage: {
            apexPage: 'SomeApexPage',
            enabled: false,
          },
        },
      })
      apexPage = new InstanceElement(
        'SomeApexPage',
        mockTypes.ApexPage,
        { [INSTANCE_FULL_NAME_FIELD]: 'SomeApexPage' },
      )
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: apexPage }),
      ]
    })

    it('should create a reference', async () => {
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage', 'apexPage'), target: apexPage.elemID },
        { source: profileInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage', 'apexPage'), target: apexPage.elemID },
      ])
    })
  })

  describe('record types', () => {
    let permissionSetInstance: InstanceElement
    let profileInstance: InstanceElement
    let recordType: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      [profileInstance, permissionSetInstance] = createTestInstances({
        recordTypeVisibilities: {
          Case: {
            SomeCaseRecordType: {
              default: true,
              recordType: 'Case.SomeCaseRecordType',
              visible: true,
            },
          },
        },
      })
      recordType = new InstanceElement(
        'Case_SomeCaseRecordType',
        mockTypes.RecordType,
        { [INSTANCE_FULL_NAME_FIELD]: 'Case.SomeCaseRecordType' },
      )
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: recordType }),
      ]
    })

    it('should create a reference', async () => {
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType', 'recordType'), target: recordType.elemID },
        { source: profileInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType', 'recordType'), target: recordType.elemID },
      ])
    })
  })
})
