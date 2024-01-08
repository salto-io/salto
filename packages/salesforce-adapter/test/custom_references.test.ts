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
import { InstanceElement, ReferenceInfo, Values, ObjectType, ElemID } from '@salto-io/adapter-api'
import { INSTANCE_FULL_NAME_FIELD } from '../src/constants'
import { mockTypes } from './mock_elements'
import { createCustomObjectType, createMetadataTypeElement } from './utils'
import { getCustomReferences } from '../src/custom_references'
import { CUSTOM_REFS_CONFIG, DATA_CONFIGURATION, FETCH_CONFIG } from '../src/types'

describe('getCustomReferences', () => {
  let refs: ReferenceInfo[]
  let permissionSetInstance: InstanceElement
  let profileInstance: InstanceElement
  const createTestInstances = (fields: Values): [InstanceElement, InstanceElement] => [
    new InstanceElement('test', mockTypes.Profile, fields),
    new InstanceElement('test', mockTypes.PermissionSet, fields),
  ]

  describe('when profile refs are disabled', () => {
    beforeEach(async () => {
      [permissionSetInstance, profileInstance] = createTestInstances({
        fieldPermissions: {
          Account: {
            testField__c: 'ReadWrite',
          },
        },
      })

      const AdapterConfigType = new ObjectType({
        elemID: new ElemID('adapter'),
        isSettings: true,
      })
      const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType, {
        [FETCH_CONFIG]: {
          [DATA_CONFIGURATION]: {
            [CUSTOM_REFS_CONFIG]: {
              profiles: false,
            },
          },
        },
      })
      refs = await getCustomReferences(
        [permissionSetInstance, profileInstance],
        adapterConfig,
      )
    })
    it('should not generate references', () => {
      expect(refs).toBeEmpty()
    })
  })
  describe('when profile custom refs config is not set', () => {
    beforeEach(async () => {
      [permissionSetInstance, profileInstance] = createTestInstances({
        fieldPermissions: {
          Account: {
            testField__c: 'ReadWrite',
          },
        },
      })

      const AdapterConfigType = new ObjectType({
        elemID: new ElemID('adapter'),
        isSettings: true,
      })
      const adapterConfig = new InstanceElement(ElemID.CONFIG_NAME, AdapterConfigType)
      refs = await getCustomReferences(
        [permissionSetInstance, profileInstance],
        adapterConfig,
      )
    })
    it('should not generate references', () => {
      expect(refs).toBeEmpty()
    })
  })
  describe('fields', () => {
    describe('when the fields are inaccessible', () => {
      beforeEach(async () => {
        [permissionSetInstance, profileInstance] = createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'NoAccess',
            },
          },
        })
        refs = await getCustomReferences(
          [permissionSetInstance, profileInstance],
          undefined,
        )
      })
      it('should not create references', async () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('when the fields are accessible', () => {
      beforeEach(async () => {
        [permissionSetInstance, profileInstance] = createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'ReadWrite',
            },
          },
        })
        refs = await getCustomReferences([permissionSetInstance, profileInstance], undefined)
      })
      it('should create references', async () => {
        const expectedSource = ['fieldPermissions', 'Account', 'testField__c']
        const expectedTarget = mockTypes.Account.elemID.createNestedID('field', 'testField__c')
        expect(refs).toEqual([
          { source: permissionSetInstance.elemID.createNestedID(...expectedSource), target: expectedTarget, type: 'weak' },
          { source: profileInstance.elemID.createNestedID(...expectedSource), target: expectedTarget, type: 'weak' },
        ])
      })
    })
  })
  describe('custom apps', () => {
    const customApp = new InstanceElement(
      'SomeApplication',
      createMetadataTypeElement('CustomApplication', {}),
      { [INSTANCE_FULL_NAME_FIELD]: 'SomeApplication' },
    )

    describe('if neither default or visible', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: false,
              visible: false,
            },
          },
        })

        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('if default', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: true,
              visible: false,
            },
          },
        })

        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'),
            target: customApp.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'),
            target: customApp.elemID,
            type: 'weak',
          },
        ])
      })
    })

    describe('if visible', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: false,
              visible: true,
            },
          },
        })

        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toIncludeAllPartialMembers([
          {
            source: permissionSetInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'),
            target: customApp.elemID,
            type: 'weak',
          },
          {
            source: profileInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'),
            target: customApp.elemID,
            type: 'weak',
          },
        ])
      })
    })
  })
  describe('apex classes', () => {
    const apexClass = new InstanceElement(
      'SomeApexClass',
      mockTypes.ApexClass,
      { [INSTANCE_FULL_NAME_FIELD]: 'SomeApexClass' },
    )

    describe('when disabled', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: 'SomeApexClass',
              enabled: false,
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('when enabled', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: 'SomeApexClass',
              enabled: true,
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('classAccesses', 'SomeApexClass'),
            target: apexClass.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('classAccesses', 'SomeApexClass'),
            target: apexClass.elemID,
            type: 'weak',
          },
        ])
      })
    })
  })
  describe('flows', () => {
    const flow = new InstanceElement(
      'SomeFlow',
      mockTypes.Flow,
      { [INSTANCE_FULL_NAME_FIELD]: 'SomeFlow' },
    )

    describe('when disabled', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: false,
              flow: 'SomeFlow',
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })
      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })
    describe('when enabled', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: true,
              flow: 'SomeFlow',
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('flowAccesses', 'SomeFlow'),
            target: flow.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('flowAccesses', 'SomeFlow'),
            target: flow.elemID,
            type: 'weak',
          },
        ])
      })
    })
  })
  describe('layouts', () => {
    const layout = new InstanceElement(
      'Account_Account_Layout@bs',
      mockTypes.Layout,
      { [INSTANCE_FULL_NAME_FIELD]: 'Account-Account Layout' },
    )

    describe('when there is a reference to a layout', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          layoutAssignments: {
            'Account_Account_Layout@bs': [
              {
                layout: 'Account-Account Layout',
              },
            ],
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
            target: layout.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
            target: layout.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('when there is a reference to a recordType', () => {
      const recordTypes = [
        new InstanceElement(
          'SomeRecordType',
          mockTypes.RecordType,
          { [INSTANCE_FULL_NAME_FIELD]: 'SomeRecordType' },
        ),
        new InstanceElement(
          'SomeOtherRecordType',
          mockTypes.RecordType,
          { [INSTANCE_FULL_NAME_FIELD]: 'SomeOtherRecordType' },
        ),
      ]
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          layoutAssignments: {
            'Account_Account_Layout@bs': [
              {
                layout: 'Account-Account Layout',
                recordType: 'SomeRecordType',
              },
              {
                layout: 'Account-Account Layout',
                recordType: 'SomeOtherRecordType',
              },
            ],
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
            target: layout.elemID,
            type: 'weak',
          },
          {
            source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
            target: recordTypes[0].elemID,
            type: 'weak',
          },
          {
            source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
            target: recordTypes[1].elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
            target: layout.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
            target: recordTypes[0].elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
            target: recordTypes[1].elemID,
            type: 'weak',
          },
        ])
      })
    })
  })
  describe('objects', () => {
    const customObject = createCustomObjectType('Account', {})

    describe('when all permissions are disabled', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          objectPermissions: {
            Account: {
              allowCreate: false,
              allowDelete: false,
              allowEdit: false,
              allowRead: false,
              modifyAllRecords: false,
              object: 'Account',
              viewAllRecords: false,
            },
          },
        })

        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should not create references', () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('when some permissions are enabled', () => {
      beforeEach(async () => {
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

        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('objectPermissions', 'Account'),
            target: customObject.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('objectPermissions', 'Account'),
            target: customObject.elemID,
            type: 'weak',
          },
        ])
      })
    })
  })
  describe('Apex pages', () => {
    const apexPage = new InstanceElement(
      'SomeApexPage',
      mockTypes.ApexPage,
      { [INSTANCE_FULL_NAME_FIELD]: 'SomeApexPage' },
    )

    describe('when disabled', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: 'SomeApexPage',
              enabled: false,
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('when enabled', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: 'SomeApexPage',
              enabled: true,
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage'),
            target: apexPage.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage'),
            target: apexPage.elemID,
            type: 'weak',
          },
        ])
      })
    })
  })
  describe('record types', () => {
    const recordType = new InstanceElement(
      'Case_SomeCaseRecordType',
      mockTypes.RecordType,
      { [INSTANCE_FULL_NAME_FIELD]: 'Case.SomeCaseRecordType' },
    )
    describe('when neither default nor visible', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          recordTypeVisibilities: {
            Case: {
              SomeCaseRecordType: {
                default: false,
                recordType: 'Case.SomeCaseRecordType',
                visible: false,
              },
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })
      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })
    describe('when default', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          recordTypeVisibilities: {
            Case: {
              SomeCaseRecordType: {
                default: true,
                recordType: 'Case.SomeCaseRecordType',
                visible: false,
              },
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'),
            target: recordType.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'),
            target: recordType.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('when visible', () => {
      beforeEach(async () => {
        [profileInstance, permissionSetInstance] = createTestInstances({
          recordTypeVisibilities: {
            Case: {
              SomeCaseRecordType: {
                default: false,
                recordType: 'Case.SomeCaseRecordType',
                visible: true,
              },
            },
          },
        })
        refs = await getCustomReferences([profileInstance, permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: profileInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'),
            target: recordType.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'),
            target: recordType.elemID,
            type: 'weak',
          },
        ])
      })
    })
  })
})
