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
  ElemID,
  Field,
  FixElementsFunc,
  InstanceElement,
  ReferenceExpression,
  ReferenceInfo,
  Values,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
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
import { profilesHandler } from '../../src/custom_references/profiles'

describe('profiles', () => {
  describe('weak references handler', () => {
    let refs: ReferenceInfo[]
    let profileInstance: InstanceElement
    const createTestInstance = (fields: Values): InstanceElement =>
      new InstanceElement('test', mockTypes.Profile, fields)

    describe('fields', () => {
      describe('when the fields are inaccessible', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            fieldPermissions: {
              Account: {
                testField__c: 'NoAccess',
              },
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create references', async () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when the fields are accessible', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            fieldPermissions: {
              Account: {
                testField__c: 'ReadWrite',
              },
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create references', async () => {
          const expectedSource = ['fieldPermissions', 'Account', 'testField__c']
          const expectedTarget = mockTypes.Account.elemID.createNestedID(
            'field',
            'testField__c',
          )
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(...expectedSource),
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
          profileInstance = createTestInstance({
            applicationVisibilities: {
              SomeApplication: {
                application: 'SomeApplication',
                default: false,
                visible: false,
              },
            },
          })

          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('if default', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            applicationVisibilities: {
              SomeApplication: {
                application: 'SomeApplication',
                default: true,
                visible: false,
              },
            },
          })

          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
            applicationVisibilities: {
              SomeApplication: {
                application: 'SomeApplication',
                default: false,
                visible: true,
              },
            },
          })

          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toIncludeAllPartialMembers([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create references', async () => {
          expect(refs).toBeEmpty()
        })
      })
    })

    describe('Apex classes', () => {
      const apexClass = new InstanceElement(
        'SomeApexClass',
        mockTypes.ApexClass,
        { [INSTANCE_FULL_NAME_FIELD]: 'SomeApexClass' },
      )

      describe('when disabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            classAccesses: {
              SomeApexClass: {
                apexClass: 'SomeApexClass',
                enabled: false,
              },
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when enabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            classAccesses: {
              SomeApexClass: {
                apexClass: 'SomeApexClass',
                enabled: true,
              },
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
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
          profileInstance = createTestInstance({
            flowAccesses: {
              SomeFlow: {
                enabled: false,
                flow: 'SomeFlow',
              },
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when enabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            flowAccesses: {
              SomeFlow: {
                enabled: true,
                flow: 'SomeFlow',
              },
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
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
          profileInstance = createTestInstance({
            layoutAssignments: {
              'Account_Account_Layout@bs': [
                {
                  layout: 'Account-Account Layout',
                },
              ],
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
                'layoutAssignments',
                'Account_Account_Layout@bs',
              ),
              target: layout.elemID,
              type: 'weak',
            },
            {
              source: profileInstance.elemID.createNestedID(
                'layoutAssignments',
                'Account_Account_Layout@bs',
              ),
              target: recordTypes[0].elemID,
              type: 'weak',
            },
            {
              source: profileInstance.elemID.createNestedID(
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
            profileInstance = createTestInstance({
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
            refs = await profilesHandler.findWeakReferences(
              [profileInstance],
              undefined,
            )
          })

          it('should not create references', async () => {
            expect(refs).toBeEmpty()
          })
        })

        describe('if a reference already exists to a recordType', () => {
          beforeEach(async () => {
            profileInstance = createTestInstance({
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
            refs = await profilesHandler.findWeakReferences(
              [profileInstance],
              undefined,
            )
          })

          it('should only create references to layout', () => {
            expect(refs).toEqual([
              {
                source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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

          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create references', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when some permissions are enabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
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

          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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

          refs = await profilesHandler.findWeakReferences([profileInstance])
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
          profileInstance = createTestInstance({
            pageAccesses: {
              SomeApexPage: {
                apexPage: 'SomeApexPage',
                enabled: false,
              },
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when enabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            pageAccesses: {
              SomeApexPage: {
                apexPage: 'SomeApexPage',
                enabled: true,
              },
            },
          })
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
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
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when default', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(
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
          profileInstance = createTestInstance({
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
          refs = await profilesHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })
    })
  })

  describe('fix elements', () => {
    const profileInstance = new InstanceElement('test', mockTypes.Profile, {
      fieldPermissions: {
        Account: {
          testField__c: 'ReadWrite',
        },
      },
      applicationVisibilities: {
        SomeApplication: {
          application: 'SomeApplication',
          default: true,
          visible: true,
        },
      },
      classAccesses: {
        SomeApexClass: {
          apexClass: 'SomeApexClass',
          enabled: true,
        },
      },
      flowAccesses: {
        SomeFlow: {
          enabled: true,
          flow: 'SomeFlow',
        },
      },
      layoutAssignments: {
        'Account_Account_Layout@bs': [
          {
            layout: 'Account-Account Layout',
          },
        ],
      },
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
      pageAccesses: {
        SomeApexPage: {
          apexPage: 'SomeApexPage',
          enabled: true,
        },
      },
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
    let fixElementsFunc: FixElementsFunc

    describe('when references are missing', () => {
      beforeEach(() => {
        const elementsSource = buildElementsSourceFromElements([])
        fixElementsFunc = profilesHandler.removeWeakReferences({
          elementsSource,
        })
      })

      it('should drop fields', async () => {
        const { fixedElements, errors } = await fixElementsFunc([
          profileInstance,
        ])
        expect(fixedElements).toEqual([
          new InstanceElement('test', mockTypes.Profile, {
            fieldPermissions: {
              Account: {},
            },
            applicationVisibilities: {},
            classAccesses: {},
            flowAccesses: {},
            layoutAssignments: {},
            objectPermissions: {},
            pageAccesses: {},
            recordTypeVisibilities: {
              Case: {},
            },
          }),
        ])
        expect(errors).toEqual([
          {
            elemID: profileInstance.elemID,
            severity: 'Info',
            message: 'Dropping profile fields which reference missing types',
            detailedMessage:
              'The profile has 8 fields which reference types which are not available in the workspace.',
          },
        ])
      })
    })

    describe('when references are resolved', () => {
      beforeEach(() => {
        const elementsSource = buildElementsSourceFromElements([
          new Field(
            mockTypes.Account,
            'testField__c',
            mockTypes.AccountSettings,
          ),
          new InstanceElement(
            'SomeApplication',
            mockTypes.CustomApplication,
            {},
          ),
          new InstanceElement('SomeApexClass', mockTypes.ApexClass, {}),
          new InstanceElement('SomeFlow', mockTypes.Flow, {}),
          new InstanceElement(
            'Account_Account_Layout@bs',
            mockTypes.Layout,
            {},
          ),
          mockTypes.Account,
          new InstanceElement('SomeApexPage', mockTypes.ApexPage, {}),
          new InstanceElement(
            'Case_SomeCaseRecordType',
            mockTypes.RecordType,
            {},
          ),
        ])
        fixElementsFunc = profilesHandler.removeWeakReferences({
          elementsSource,
        })
      })

      it('should drop fields', async () => {
        const { fixedElements, errors } = await fixElementsFunc([
          profileInstance,
        ])
        expect(fixedElements).toBeEmpty()
        expect(errors).toBeEmpty()
      })
    })

    describe('when some references are resolved', () => {
      beforeEach(() => {
        const elementsSource = buildElementsSourceFromElements([
          new InstanceElement(
            'Account_Account_Layout@bs',
            mockTypes.Layout,
            {},
          ),
          mockTypes.Account,
          new InstanceElement('SomeApexPage', mockTypes.ApexPage, {}),
          new InstanceElement(
            'Case_SomeCaseRecordType',
            mockTypes.RecordType,
            {},
          ),
        ])
        fixElementsFunc = profilesHandler.removeWeakReferences({
          elementsSource,
        })
      })

      it('should drop fields', async () => {
        const { fixedElements, errors } = await fixElementsFunc([
          profileInstance,
        ])
        expect(fixedElements).toEqual([
          new InstanceElement('test', mockTypes.Profile, {
            fieldPermissions: {
              Account: {},
            },
            applicationVisibilities: {},
            classAccesses: {},
            flowAccesses: {},
            layoutAssignments: {
              'Account_Account_Layout@bs': [
                {
                  layout: 'Account-Account Layout',
                },
              ],
            },
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
            pageAccesses: {
              SomeApexPage: {
                apexPage: 'SomeApexPage',
                enabled: true,
              },
            },
            recordTypeVisibilities: {
              Case: {
                SomeCaseRecordType: {
                  default: true,
                  recordType: 'Case.SomeCaseRecordType',
                  visible: false,
                },
              },
            },
          }),
        ])
        expect(errors).toEqual([
          {
            elemID: profileInstance.elemID,
            severity: 'Info',
            message: 'Dropping profile fields which reference missing types',
            detailedMessage:
              'The profile has 4 fields which reference types which are not available in the workspace.',
          },
        ])
      })
    })
  })
})
