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

    it('should add references only for each detailed change in a modification', async () => {
      const fieldAfter = field.clone()
      fieldAfter.annotations.someAnn = 'val'
      const refs = await getAdditionalReferences([
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: field, after: fieldAfter }),
      ])

      expect(refs).toEqual([
        { source: permissionSetInstance.elemID.createNestedID('fieldPermissions', 'Account', 'testField__c'), target: field.elemID.createNestedID('someAnn') },
        { source: profileInstance.elemID.createNestedID('fieldPermissions', 'Account', 'testField__c'), target: field.elemID.createNestedID('someAnn') },
      ])
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
    })

    it('should create a reference to addition', async () => {
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: customApp }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'), target: customApp.elemID },
        { source: profileInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'), target: customApp.elemID },
      ])
    })

    it('should create a reference to modification', async () => {
      const customAppAfter = customApp.clone()
      customApp.annotations.someAnn = 'val'
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ before: customApp, after: customAppAfter }),
      ]
      const refs = await getAdditionalReferences(changes)

      expect(refs).toEqual([
        { source: profileInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'), target: customApp.elemID.createNestedID('someAnn') },
        { source: permissionSetInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'), target: customApp.elemID.createNestedID('someAnn') },
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
    })

    it('should create a reference to addition', async () => {
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: apexClass }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('classAccesses', 'SomeApexClass'), target: apexClass.elemID },
        { source: profileInstance.elemID.createNestedID('classAccesses', 'SomeApexClass'), target: apexClass.elemID },
      ])
    })

    it('should create a reference to modification', async () => {
      const apexClassAfter = apexClass.clone()
      apexClass.annotations.someAnn = 'val'
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ before: apexClass, after: apexClassAfter }),
      ]
      const refs = await getAdditionalReferences(changes)

      expect(refs).toEqual([
        { source: profileInstance.elemID.createNestedID('classAccesses', 'SomeApexClass'), target: apexClass.elemID.createNestedID('someAnn') },
        { source: permissionSetInstance.elemID.createNestedID('classAccesses', 'SomeApexClass'), target: apexClass.elemID.createNestedID('someAnn') },
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
    })

    it('should create a reference to addition', async () => {
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: flow }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('flowAccesses', 'SomeFlow'), target: flow.elemID },
        { source: profileInstance.elemID.createNestedID('flowAccesses', 'SomeFlow'), target: flow.elemID },
      ])
    })

    it('should create a reference to modification', async () => {
      const flowAfter = flow.clone()
      flow.annotations.someAnn = 'val'
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ before: flow, after: flowAfter }),
      ]
      const refs = await getAdditionalReferences(changes)

      expect(refs).toEqual([
        { source: profileInstance.elemID.createNestedID('flowAccesses', 'SomeFlow'), target: flow.elemID.createNestedID('someAnn') },
        { source: permissionSetInstance.elemID.createNestedID('flowAccesses', 'SomeFlow'), target: flow.elemID.createNestedID('someAnn') },
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
    })

    it('should create a reference to addition', async () => {
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: layout }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toHaveLength(2)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout'), target: layout.elemID },
        { source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout'), target: layout.elemID },
      ])
    })

    it('should create a reference to modification', async () => {
      const layoutAfter = layout.clone()
      layout.annotations.someAnn = 'val'
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ before: layout, after: layoutAfter }),
      ]
      const refs = await getAdditionalReferences(changes)

      expect(refs).toEqual([
        { source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout'), target: layout.elemID.createNestedID('someAnn') },
        { source: permissionSetInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout'), target: layout.elemID.createNestedID('someAnn') },
      ])
    })

    describe('with recordType reference', () => {
      let recordType: InstanceElement
      beforeEach(() => {
        recordType = new InstanceElement(
          'SomeRecordType',
          mockTypes.RecordType,
          { [INSTANCE_FULL_NAME_FIELD]: 'SomeRecordType' },
        )
        profileInstance.value.layoutAssignments.Account_Account_Layout[0].recordType = 'SomeRecordType'
      })

      it('should create a recordType reference on addition', async () => {
        changes = [
          toChange({ before: profileInstance, after: profileInstance }),
          toChange({ before: permissionSetInstance, after: permissionSetInstance }),
          toChange({ after: layout }),
          toChange({ after: recordType }),
        ]

        const refs = await getAdditionalReferences(changes)
        expect(refs).toIncludeAllPartialMembers([
          { source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout'), target: recordType.elemID },
        ])
      })

      it('should create a recordType reference on modification', async () => {
        const recordTypeAfter = recordType.clone()
        recordTypeAfter.annotations.someAnn = 'val'
        const layoutAfter = layout.clone()
        layout.annotations.someAnn = 'val'
        changes = [
          toChange({ before: profileInstance, after: profileInstance }),
          toChange({ before: permissionSetInstance, after: permissionSetInstance }),
          toChange({ before: layout, after: layoutAfter }),
          toChange({ before: recordType, after: recordTypeAfter }),
        ]
        const refs = await getAdditionalReferences(changes)

        expect(refs).toIncludeAllPartialMembers([
          { source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout'), target: recordType.elemID.createNestedID('someAnn') },
        ])
      })
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
    })

    it('should create a reference to addition', async () => {
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: customObject }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('objectPermissions', 'Account'), target: customObject.elemID },
        { source: profileInstance.elemID.createNestedID('objectPermissions', 'Account'), target: customObject.elemID },
      ])
    })

    it('should create a reference to modification', async () => {
      const customObjectAfter = customObject.clone()
      customObjectAfter.annotations.someAnn = 'val'
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ before: customObject, after: customObjectAfter }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toEqual([
        { source: profileInstance.elemID.createNestedID('objectPermissions', 'Account'), target: customObject.elemID.createNestedID('attr', 'someAnn') },
        { source: permissionSetInstance.elemID.createNestedID('objectPermissions', 'Account'), target: customObject.elemID.createNestedID('attr', 'someAnn') },
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
    })

    it('should create a reference to addition', async () => {
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: apexPage }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage'), target: apexPage.elemID },
        { source: profileInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage'), target: apexPage.elemID },
      ])
    })

    it('should create a reference to modification', async () => {
      const apexPageAfter = apexPage.clone()
      apexPageAfter.annotations.someAnn = 'val'
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ before: apexPage, after: apexPageAfter }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage'), target: apexPage.elemID.createNestedID('someAnn') },
        { source: profileInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage'), target: apexPage.elemID.createNestedID('someAnn') },
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
    })

    it('should create a reference to addition', async () => {
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ after: recordType }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'), target: recordType.elemID },
        { source: profileInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'), target: recordType.elemID },
      ])
    })

    it('should create a reference to modification', async () => {
      const recordTypeAfter = recordType.clone()
      recordTypeAfter.annotations.someAnn = 'val'
      changes = [
        toChange({ before: profileInstance, after: profileInstance }),
        toChange({ before: permissionSetInstance, after: permissionSetInstance }),
        toChange({ before: recordType, after: recordTypeAfter }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        { source: permissionSetInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'), target: recordType.elemID.createNestedID('someAnn') },
        { source: profileInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'), target: recordType.elemID.createNestedID('someAnn') },
      ])
    })
  })
})
