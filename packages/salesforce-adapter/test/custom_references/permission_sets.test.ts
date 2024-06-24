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
  InstanceElement,
  ReferenceInfo,
  Values,
  ElemID,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  CUSTOM_APPLICATION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  RECORD_TYPE_METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType, createMetadataTypeElement } from '../utils'
import { permissionSetsHandler } from '../../src/custom_references/permission_sets'

const { findWeakReferences } = permissionSetsHandler

describe('permission sets custom references', () => {
  let refs: ReferenceInfo[]
  let permissionSetInstance: InstanceElement
  const createTestInstances = (fields: Values): InstanceElement =>
    new InstanceElement('test', mockTypes.PermissionSet, fields)

  describe('fields', () => {
    describe('when the fields are inaccessible', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'NoAccess',
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should not create references', async () => {
        expect(refs).toBeEmpty()
      })
    })
    describe('when the fields are accessible', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'ReadWrite',
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should create references', async () => {
        const expectedSource = ['fieldPermissions', 'Account', 'testField__c']
        const expectedTarget = mockTypes.Account.elemID.createNestedID(
          'field',
          'testField__c',
        )
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              ...expectedSource,
            ),
            target: expectedTarget,
            type: 'weak',
          },
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
        permissionSetInstance = createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: false,
              visible: false,
            },
          },
        })

        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('if default', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: true,
              visible: false,
            },
          },
        })

        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'applicationVisibilities',
              'SomeApplication',
            ),
            target: customApp.elemID,
            type: 'weak',
          },
        ])
      })
    })

    describe('if visible', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: false,
              visible: true,
            },
          },
        })

        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toIncludeAllPartialMembers([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'applicationVisibilities',
              'SomeApplication',
            ),
            target: customApp.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('if a reference already exists', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: new ReferenceExpression(
                new ElemID(
                  SALESFORCE,
                  CUSTOM_APPLICATION_METADATA_TYPE,
                  'instance',
                  'SomeApplication',
                ),
              ),
              default: false,
              visible: true,
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should not create references', async () => {
        expect(refs).toBeEmpty()
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
        permissionSetInstance = createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: 'SomeApexClass',
              enabled: false,
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('when enabled', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: 'SomeApexClass',
              enabled: true,
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'classAccesses',
              'SomeApexClass',
            ),
            target: apexClass.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('if a reference already exists', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: new ReferenceExpression(
                new ElemID(
                  SALESFORCE,
                  APEX_CLASS_METADATA_TYPE,
                  'instance',
                  'SomeApexClass',
                ),
              ),
              enabled: true,
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should not create references', async () => {
        expect(refs).toBeEmpty()
      })
    })
  })
  describe('flows', () => {
    const flow = new InstanceElement('SomeFlow', mockTypes.Flow, {
      [INSTANCE_FULL_NAME_FIELD]: 'SomeFlow',
    })

    describe('when disabled', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: false,
              flow: 'SomeFlow',
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })
    describe('when enabled', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: true,
              flow: 'SomeFlow',
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'flowAccesses',
              'SomeFlow',
            ),
            target: flow.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('if a reference already exists', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: true,
              flow: new ReferenceExpression(
                new ElemID(
                  SALESFORCE,
                  FLOW_METADATA_TYPE,
                  'instance',
                  'SomeFlow',
                ),
              ),
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should not create references', async () => {
        expect(refs).toBeEmpty()
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
        permissionSetInstance = createTestInstances({
          layoutAssignments: {
            'Account_Account_Layout@bs': [
              {
                layout: 'Account-Account Layout',
              },
            ],
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'layoutAssignments',
              'Account_Account_Layout@bs',
            ),
            target: layout.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('when there is a reference to a recordType', () => {
      const recordTypes = [
        new InstanceElement('SomeRecordType', mockTypes.RecordType, {
          [INSTANCE_FULL_NAME_FIELD]: 'SomeRecordType',
        }),
        new InstanceElement('SomeOtherRecordType', mockTypes.RecordType, {
          [INSTANCE_FULL_NAME_FIELD]: 'SomeOtherRecordType',
        }),
      ]
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
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
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'layoutAssignments',
              'Account_Account_Layout@bs',
            ),
            target: layout.elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID(
              'layoutAssignments',
              'Account_Account_Layout@bs',
            ),
            target: recordTypes[0].elemID,
            type: 'weak',
          },
          {
            source: permissionSetInstance.elemID.createNestedID(
              'layoutAssignments',
              'Account_Account_Layout@bs',
            ),
            target: recordTypes[1].elemID,
            type: 'weak',
          },
        ])
      })
      describe('if a reference already exists to a layout', () => {
        beforeEach(async () => {
          permissionSetInstance = createTestInstances({
            layoutAssignments: {
              'Account_Account_Layout@bs': [
                {
                  layout: new ReferenceExpression(
                    new ElemID(
                      SALESFORCE,
                      LAYOUT_TYPE_ID_METADATA_TYPE,
                      'instance',
                      'Account-Account Layout',
                    ),
                  ),
                },
              ],
            },
          })
          refs = await findWeakReferences([permissionSetInstance], undefined)
        })
        it('should not create references', async () => {
          expect(refs).toBeEmpty()
        })
      })
      describe('if a reference already exists to a recordType', () => {
        beforeEach(async () => {
          permissionSetInstance = createTestInstances({
            layoutAssignments: {
              'Account_Account_Layout@bs': [
                {
                  layout: 'Account-Account Layout',
                  recordType: new ReferenceExpression(
                    new ElemID(
                      SALESFORCE,
                      RECORD_TYPE_METADATA_TYPE,
                      'instance',
                      'SomeRecordType',
                    ),
                  ),
                },
                {
                  layout: 'Account-Account Layout',
                  recordType: new ReferenceExpression(
                    new ElemID(
                      SALESFORCE,
                      RECORD_TYPE_METADATA_TYPE,
                      'instance',
                      'SomeOtherRecordType',
                    ),
                  ),
                },
              ],
            },
          })
          refs = await findWeakReferences([permissionSetInstance], undefined)
        })
        it('should only create references to layout', () => {
          expect(refs).toEqual([
            {
              source: permissionSetInstance.elemID.createNestedID(
                'layoutAssignments',
                'Account_Account_Layout@bs',
              ),
              target: layout.elemID,
              type: 'weak',
            },
          ])
        })
      })
    })
  })
  describe('objects', () => {
    const customObject = createCustomObjectType('Account', {})

    describe('when all permissions are disabled', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
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

        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should not create references', () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('when some permissions are enabled', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
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

        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'objectPermissions',
              'Account',
            ),
            target: customObject.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('when a reference already exists', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          objectPermissions: {
            Account: {
              allowCreate: true,
              allowDelete: true,
              allowEdit: true,
              allowRead: true,
              modifyAllRecords: false,
              object: new ReferenceExpression(
                new ElemID(SALESFORCE, 'Account'),
              ),
              viewAllRecords: false,
            },
          },
        })

        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })
  })
  describe('Apex pages', () => {
    const apexPage = new InstanceElement('SomeApexPage', mockTypes.ApexPage, {
      [INSTANCE_FULL_NAME_FIELD]: 'SomeApexPage',
    })

    describe('when disabled', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: 'SomeApexPage',
              enabled: false,
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })

    describe('when enabled', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: 'SomeApexPage',
              enabled: true,
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'pageAccesses',
              'SomeApexPage',
            ),
            target: apexPage.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('when a reference already exists', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: new ReferenceExpression(
                new ElemID(
                  SALESFORCE,
                  APEX_PAGE_METADATA_TYPE,
                  'instance',
                  'SomeApexPage',
                ),
              ),
              enabled: true,
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })

      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
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
        permissionSetInstance = createTestInstances({
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
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })
    describe('when default', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
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
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'recordTypeVisibilities',
              'Case',
              'SomeCaseRecordType',
            ),
            target: recordType.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('when visible', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
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
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should create a reference', () => {
        expect(refs).toEqual([
          {
            source: permissionSetInstance.elemID.createNestedID(
              'recordTypeVisibilities',
              'Case',
              'SomeCaseRecordType',
            ),
            target: recordType.elemID,
            type: 'weak',
          },
        ])
      })
    })
    describe('when visible and a reference already exists', () => {
      beforeEach(async () => {
        permissionSetInstance = createTestInstances({
          recordTypeVisibilities: {
            Case: {
              SomeCaseRecordType: {
                default: false,
                recordType: new ReferenceExpression(
                  new ElemID(
                    SALESFORCE,
                    RECORD_TYPE_METADATA_TYPE,
                    'instance',
                    'Case.SomeCaseRecordType',
                  ),
                ),
                visible: true,
              },
            },
          },
        })
        refs = await findWeakReferences([permissionSetInstance], undefined)
      })
      it('should not create a reference', () => {
        expect(refs).toBeEmpty()
      })
    })
  })
})
