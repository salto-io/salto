/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ElemID,
  FixElementsFunc,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  ReferenceInfo,
  Values,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  APEX_CLASS_METADATA_TYPE,
  APEX_PAGE_METADATA_TYPE,
  API_NAME,
  ArtificialTypes,
  CUSTOM_APPLICATION_METADATA_TYPE,
  CUSTOM_OBJECT,
  FLOW_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  LAYOUT_TYPE_ID_METADATA_TYPE,
  METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  PROFILE_METADATA_TYPE,
  RECORD_TYPE_METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { mockTypes } from '../mock_elements'
import { createCustomObjectType, createMetadataTypeElement } from '../utils'
import {
  buildElemIDMetadataQuery,
  profilesAndPermissionSetsHandler,
} from '../../src/custom_references/profiles_and_permission_sets'
import { MetadataQuery } from '../../src/types'
import { buildMetadataQuery } from '../../src/fetch_profile/metadata_query'

const HANDLED_TYPES = [
  PROFILE_METADATA_TYPE,
  PERMISSION_SET_METADATA_TYPE,
  MUTING_PERMISSION_SET_METADATA_TYPE,
] as const

describe('Profiles And Permission Sets Custom References', () => {
  describe.each(HANDLED_TYPES)('%s weak references handler', typeName => {
    let refs: ReferenceInfo[]
    let profileInstance: InstanceElement
    const createTestInstance = (fields: Values): InstanceElement =>
      new InstanceElement('test', new ObjectType({ elemID: new ElemID(SALESFORCE, typeName) }), fields)

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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create references', async () => {
          const expectedSource = ['fieldPermissions', 'Account', 'testField__c']
          const expectedTarget = mockTypes.Account.elemID.createNestedID('field', 'testField__c')
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID(...expectedSource),
              target: expectedTarget,
              type: 'weak',
              sourceScope: 'value',
            },
          ])
        })
      })
    })

    describe('custom apps', () => {
      const customApp = new InstanceElement('SomeApplication', createMetadataTypeElement('CustomApplication', {}), {
        [INSTANCE_FULL_NAME_FIELD]: 'SomeApplication',
      })

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

          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
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

          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'),
              target: customApp.elemID,
              type: 'weak',
              sourceScope: 'value',
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

          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toIncludeAllPartialMembers([
            {
              source: profileInstance.elemID.createNestedID('applicationVisibilities', 'SomeApplication'),
              target: customApp.elemID,
              type: 'weak',
              sourceScope: 'value',
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
                  new ElemID(SALESFORCE, CUSTOM_APPLICATION_METADATA_TYPE, 'instance', 'SomeApplication'),
                ),
                default: false,
                visible: true,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create references', async () => {
          expect(refs).toBeEmpty()
        })
      })
    })

    describe('data category groups', () => {
      const dataCategoryGroup = new InstanceElement('SomeDataCategoryGroup', mockTypes.DataCategoryGroup, {
        [INSTANCE_FULL_NAME_FIELD]: 'SomeDataCategoryGroup',
      })

      describe('when disabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            categoryGroupVisibilities: {
              SomeDataCategoryGroup: {
                dataCategoryGroup: 'SomeDataCategoryGroup',
                enabled: false,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when enabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            categoryGroupVisibilities: {
              SomeDataCategoryGroup: {
                dataCategoryGroup: 'SomeDataCategoryGroup',
                enabled: true,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('categoryGroupVisibilities', 'SomeDataCategoryGroup'),
              target: dataCategoryGroup.elemID,
              type: 'weak',
              sourceScope: 'value',
            },
          ])
        })
      })
    })

    describe('Apex classes', () => {
      const apexClass = new InstanceElement('SomeApexClass', mockTypes.ApexClass, {
        [INSTANCE_FULL_NAME_FIELD]: 'SomeApexClass',
      })

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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('classAccesses', 'SomeApexClass'),
              target: apexClass.elemID,
              type: 'weak',
              sourceScope: 'value',
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
                  new ElemID(SALESFORCE, APEX_CLASS_METADATA_TYPE, 'instance', 'SomeApexClass'),
                ),
                enabled: true,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create references', async () => {
          expect(refs).toBeEmpty()
        })
      })
    })

    describe('custom metadata', () => {
      const customMetadataName = mockTypes.CustomMetadataRecordType.annotations[API_NAME]

      describe('when disabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            customMetadataTypeAccesses: {
              [customMetadataName]: {
                name: customMetadataName,
                enabled: false,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when enabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            customMetadataTypeAccesses: {
              [customMetadataName]: {
                name: customMetadataName,
                enabled: true,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('customMetadataTypeAccesses', customMetadataName),
              target: mockTypes.CustomMetadataRecordType.elemID,
              type: 'weak',
              sourceScope: 'value',
            },
          ])
        })
      })
    })

    describe('custom permissions', () => {
      const customPermission = new InstanceElement('SomeCustomPermission', mockTypes.CustomPermission, {
        [INSTANCE_FULL_NAME_FIELD]: 'SomeCustomPermission',
      })

      describe('when disabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            customPermissions: {
              SomeCustomPermission: {
                name: 'SomeCustomPermission',
                enabled: false,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when enabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            customPermissions: {
              SomeCustomPermission: {
                name: 'SomeCustomPermission',
                enabled: true,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('customPermissions', 'SomeCustomPermission'),
              target: customPermission.elemID,
              type: 'weak',
              sourceScope: 'value',
            },
          ])
        })
      })
    })

    describe('external data sources', () => {
      const externalDataSource = new InstanceElement('SomeExternalDataSource', mockTypes.ExternalDataSource, {
        [INSTANCE_FULL_NAME_FIELD]: 'SomeExternalDataSource',
      })

      describe('when disabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            externalDataSourceAccesses: {
              SomeExternalDataSource: {
                externalDataSource: 'SomeExternalDataSource',
                enabled: false,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })

      describe('when enabled', () => {
        beforeEach(async () => {
          profileInstance = createTestInstance({
            externalDataSourceAccesses: {
              SomeExternalDataSource: {
                externalDataSource: 'SomeExternalDataSource',
                enabled: true,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('externalDataSourceAccesses', 'SomeExternalDataSource'),
              target: externalDataSource.elemID,
              type: 'weak',
              sourceScope: 'value',
            },
          ])
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('flowAccesses', 'SomeFlow'),
              target: flow.elemID,
              type: 'weak',
              sourceScope: 'value',
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
                flow: new ReferenceExpression(new ElemID(SALESFORCE, FLOW_METADATA_TYPE, 'instance', 'SomeFlow')),
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create references', async () => {
          expect(refs).toBeEmpty()
        })
      })
    })

    describe('layouts', () => {
      const layout = new InstanceElement('Account_Account_Layout@bs', mockTypes.Layout, {
        [INSTANCE_FULL_NAME_FIELD]: 'Account-Account Layout',
      })

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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
              target: layout.elemID,
              type: 'weak',
              sourceScope: 'value',
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
              target: layout.elemID,
              type: 'weak',
              sourceScope: 'value',
            },
            {
              source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
              target: recordTypes[0].elemID,
              type: 'weak',
              sourceScope: 'value',
            },
            {
              source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
              target: recordTypes[1].elemID,
              type: 'weak',
              sourceScope: 'value',
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
                      new ElemID(SALESFORCE, LAYOUT_TYPE_ID_METADATA_TYPE, 'instance', 'Account-Account Layout'),
                    ),
                  },
                ],
              },
            })
            refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance], undefined)
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
                      new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE, 'instance', 'SomeRecordType'),
                    ),
                  },
                  {
                    layout: 'Account-Account Layout',
                    recordType: new ReferenceExpression(
                      new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE, 'instance', 'SomeOtherRecordType'),
                    ),
                  },
                ],
              },
            })
            refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance], undefined)
          })

          it('should only create references to layout', () => {
            expect(refs).toEqual([
              {
                source: profileInstance.elemID.createNestedID('layoutAssignments', 'Account_Account_Layout@bs'),
                target: layout.elemID,
                type: 'weak',
                sourceScope: 'value',
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

          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
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

          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('objectPermissions', 'Account'),
              target: customObject.elemID,
              type: 'weak',
              sourceScope: 'value',
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
                object: new ReferenceExpression(new ElemID(SALESFORCE, 'Account')),
                viewAllRecords: false,
              },
            },
          })

          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('pageAccesses', 'SomeApexPage'),
              target: apexPage.elemID,
              type: 'weak',
              sourceScope: 'value',
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
                  new ElemID(SALESFORCE, APEX_PAGE_METADATA_TYPE, 'instance', 'SomeApexPage'),
                ),
                enabled: true,
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })
    })

    describe('record types', () => {
      const recordType = new InstanceElement('Case_SomeCaseRecordType', mockTypes.RecordType, {
        [INSTANCE_FULL_NAME_FIELD]: 'Case.SomeCaseRecordType',
      })

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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'),
              target: recordType.elemID,
              type: 'weak',
              sourceScope: 'value',
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
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should create a reference', () => {
          expect(refs).toEqual([
            {
              source: profileInstance.elemID.createNestedID('recordTypeVisibilities', 'Case', 'SomeCaseRecordType'),
              target: recordType.elemID,
              type: 'weak',
              sourceScope: 'value',
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
                    new ElemID(SALESFORCE, RECORD_TYPE_METADATA_TYPE, 'instance', 'Case.SomeCaseRecordType'),
                  ),
                  visible: true,
                },
              },
            },
          })
          refs = await profilesAndPermissionSetsHandler.findWeakReferences([profileInstance])
        })

        it('should not create a reference', () => {
          expect(refs).toBeEmpty()
        })
      })
    })
  })

  describe.each(HANDLED_TYPES)('%s fix elements', typeName => {
    const metadataType = new ObjectType({ elemID: new ElemID(SALESFORCE, typeName) })
    const instance = new InstanceElement('test', metadataType, {
      fieldPermissions: {
        Account: {
          testField__c: 'ReadWrite',
          // Make sure we don't omit non-custom fields with broken reference
          testField: 'ReadWrite',
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
        // Make sure we don't omit values of Elements that are not managed in the environment
        sbaa__ApexClass: {
          apexClass: 'sbaa__ApexClass',
          enabled: true,
        },
        // Make sure we don't omit values that are defined in the Broken Paths instance
        BrokenApexClass: {
          apexClass: 'sbaa__ApexClass',
          enabled: true,
        },
        // Make sure we omit values even though we don't create custom references for them.
        DefaultAccessNonExisting: {
          apexClass: 'DefaultAccessNonExisting',
          enabled: 'true',
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
        // Make sure we don't omit values of standard objects with broken reference
        Account: {
          allowCreate: true,
          allowDelete: true,
          allowEdit: true,
          allowRead: true,
          modifyAllRecords: false,
          object: 'Account',
          viewAllRecords: false,
        },
        TestObj__c: {
          allowCreate: true,
          allowDelete: true,
          allowEdit: true,
          allowRead: true,
          modifyAllRecords: false,
          object: 'TestObj__c',
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
        fixElementsFunc = profilesAndPermissionSetsHandler.removeWeakReferences({
          elementsSource,
          config: {
            fetch: {
              metadata: {
                include: [
                  {
                    metadataType: '.*',
                    name: '.*',
                    namespace: '',
                  },
                ],
              },
            },
          },
        })
      })

      it('should drop fields', async () => {
        const { fixedElements, errors } = await fixElementsFunc([instance])
        expect(fixedElements).toEqual([
          new InstanceElement('test', metadataType, {
            fieldPermissions: {
              Account: {
                testField: 'ReadWrite',
              },
            },
            applicationVisibilities: {},
            classAccesses: {
              sbaa__ApexClass: {
                apexClass: 'sbaa__ApexClass',
                enabled: true,
              },
              BrokenApexClass: {
                apexClass: 'sbaa__ApexClass',
                enabled: true,
              },
            },
            flowAccesses: {},
            layoutAssignments: {},
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
            pageAccesses: {},
            recordTypeVisibilities: {
              Case: {},
            },
          }),
        ])
        expect(errors).toEqual([
          {
            elemID: instance.elemID,
            severity: 'Info',
            message: 'Omitting entries which reference unavailable types',
            detailedMessage: `The ${typeName} has entries which reference types which are not available in the environment and will not be deployed. You can learn more about this message here: https://help.salto.io/en/articles/9546243-omitting-profile-entries-which-reference-unavailable-types`,
          },
        ])
      })
    })

    describe('when references are resolved', () => {
      beforeEach(() => {
        const elementsSource = buildElementsSourceFromElements([
          new ObjectType({
            elemID: new ElemID('salesforce', 'Account'),
            fields: {
              testField__c: { refType: mockTypes.AccountSettings },
            },
            annotations: {
              [METADATA_TYPE]: CUSTOM_OBJECT,
              [API_NAME]: 'Account',
            },
          }),
          createCustomObjectType('TestObj__c', {}),
          new InstanceElement('SomeApplication', mockTypes.CustomApplication, {}),
          new InstanceElement('SomeApexClass', mockTypes.ApexClass, {}),
          new InstanceElement('DefaultAccessNonExisting', mockTypes.ApexClass, {}),
          new InstanceElement('SomeFlow', mockTypes.Flow, {}),
          new InstanceElement('Account_Account_Layout@bs', mockTypes.Layout, {}),
          new InstanceElement('SomeApexPage', mockTypes.ApexPage, {}),
          new InstanceElement('Case_SomeCaseRecordType', mockTypes.RecordType, {}),
          new InstanceElement(ElemID.CONFIG_NAME, ArtificialTypes.ProfilesAndPermissionSetsBrokenPaths, {
            paths: ['classAccesses.BrokenApexClass'],
          }),
        ])
        fixElementsFunc = profilesAndPermissionSetsHandler.removeWeakReferences({
          elementsSource,
          config: {
            fetch: {
              metadata: {
                include: [
                  {
                    metadataType: '.*',
                    name: '.*',
                    namespace: '',
                  },
                ],
              },
            },
          },
        })
      })

      it('should not drop fields', async () => {
        const { fixedElements, errors } = await fixElementsFunc([instance])
        expect(fixedElements).toBeEmpty()
        expect(errors).toBeEmpty()
      })
    })

    describe('when some references are resolved', () => {
      beforeEach(() => {
        const elementsSource = buildElementsSourceFromElements([
          new InstanceElement('Account_Account_Layout@bs', mockTypes.Layout, {}),
          mockTypes.Account,
          createCustomObjectType('TestObj__c', {}),
          new InstanceElement('SomeApexPage', mockTypes.ApexPage, {}),
          new InstanceElement('Case_SomeCaseRecordType', mockTypes.RecordType, {}),
        ])
        fixElementsFunc = profilesAndPermissionSetsHandler.removeWeakReferences({
          elementsSource,
          config: {},
        })
      })

      it('should drop fields', async () => {
        const { fixedElements, errors } = await fixElementsFunc([instance])
        expect(fixedElements).toEqual([
          new InstanceElement('test', metadataType, {
            fieldPermissions: {
              Account: {
                testField: 'ReadWrite',
              },
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
              TestObj__c: {
                allowCreate: true,
                allowDelete: true,
                allowEdit: true,
                allowRead: true,
                modifyAllRecords: false,
                object: 'TestObj__c',
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
            elemID: instance.elemID,
            severity: 'Info',
            message: 'Omitting entries which reference unavailable types',
            detailedMessage: `The ${typeName} has entries which reference types which are not available in the environment and will not be deployed. You can learn more about this message here: https://help.salto.io/en/articles/9546243-omitting-profile-entries-which-reference-unavailable-types`,
          },
        ])
      })
    })
  })

  describe('buildElemIDMetadataQuery', () => {
    let metadataQuery: MetadataQuery
    let elemIDMetadataQuery: MetadataQuery<ElemID>
    describe('CustomObjects', () => {
      beforeEach(() => {
        metadataQuery = buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [{ metadataType: 'CustomObject', namespace: '' }],
            },
          },
        })
        elemIDMetadataQuery = buildElemIDMetadataQuery(metadataQuery)
      })
      it('should return true for included CustomObject', () => {
        expect(new ElemID('salesforce', 'Account')).toSatisfy(elemIDMetadataQuery.isInstanceIncluded)
        expect(new ElemID('salesforce', 'Account')).toSatisfy(elemIDMetadataQuery.isInstanceMatch)
      })
      it('should return false for excluded CustomObject from namespace', () => {
        expect(new ElemID('salesforce', 'sbaa__Account__c')).not.toSatisfy(elemIDMetadataQuery.isInstanceIncluded)
        expect(new ElemID('salesforce', 'sbaa__Account__c')).not.toSatisfy(elemIDMetadataQuery.isInstanceMatch)
      })
    })
    describe('Instances', () => {
      beforeEach(() => {
        metadataQuery = buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [{ metadataType: 'ApexClass', namespace: '', name: 'Apex1' }],
            },
          },
        })
        elemIDMetadataQuery = buildElemIDMetadataQuery(metadataQuery)
      })
      it('should return true for included instance', () => {
        expect(new ElemID('salesforce', 'ApexClass', 'instance', 'Apex1')).toSatisfy(
          elemIDMetadataQuery.isInstanceIncluded,
        )
        expect(new ElemID('salesforce', 'ApexClass', 'instance', 'Apex1')).toSatisfy(
          elemIDMetadataQuery.isInstanceMatch,
        )
      })
      it('should return false for excluded instance', () => {
        expect(new ElemID('salesforce', 'ApexClass', 'instance', 'Apex2')).not.toSatisfy(
          elemIDMetadataQuery.isInstanceIncluded,
        )
        expect(new ElemID('salesforce', 'ApexClass', 'instance', 'Apex2')).not.toSatisfy(
          elemIDMetadataQuery.isInstanceMatch,
        )
      })
    })
    describe('Instances from standard namespace', () => {
      beforeEach(() => {
        metadataQuery = buildMetadataQuery({
          fetchParams: {
            metadata: {
              include: [{ metadataType: 'ApexClass', namespace: '' }],
            },
          },
        })
        elemIDMetadataQuery = buildElemIDMetadataQuery(metadataQuery)
      })
      it('should return true for included instance', () => {
        expect(new ElemID('salesforce', 'ApexClass', 'instance', 'standard__Apex1')).toSatisfy(
          elemIDMetadataQuery.isInstanceIncluded,
        )
        expect(new ElemID('salesforce', 'ApexClass', 'instance', 'standard__Apex1')).toSatisfy(
          elemIDMetadataQuery.isInstanceMatch,
        )
      })
      it('should return false for excluded instance', () => {
        expect(new ElemID('salesforce', 'ApexClass', 'instance', 'sbaa__Apex2')).not.toSatisfy(
          elemIDMetadataQuery.isInstanceIncluded,
        )
        expect(new ElemID('salesforce', 'ApexClass', 'instance', 'sbaa__Apex2')).not.toSatisfy(
          elemIDMetadataQuery.isInstanceMatch,
        )
      })
    })
  })
})
