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
import _ from 'lodash'
import {
  BuiltinTypes,
  Change,
  Field,
  InstanceElement,
  ObjectType,
  toChange,
  Values,
} from '@salto-io/adapter-api'
import { API_NAME, INSTANCE_FULL_NAME_FIELD } from '../src/constants'
import { getAdditionalReferences } from '../src/additional_references'
import { mockTypes } from './mock_elements'
import { createCustomObjectType, createMetadataTypeElement } from './utils'

describe('getAdditionalReferences', () => {
  const createTestInstances = (
    fields: Values,
  ): [InstanceElement, InstanceElement] => [
    new InstanceElement('test', mockTypes.Profile, fields),
    new InstanceElement('test', mockTypes.PermissionSet, fields),
  ]

  describe('fields', () => {
    let field: Field

    beforeEach(() => {
      field = new Field(
        mockTypes.Account,
        'testField__c',
        BuiltinTypes.STRING,
        {
          [API_NAME]: 'Account.testField__c',
        },
      )
    })

    it('should not create references for new field with no access', async () => {
      const [permissionSetInstanceBefore, profileInstanceBefore] =
        createTestInstances({
          fieldPermissions: {
            Account: {},
          },
        })
      const [permissionSetInstanceAfter, profileInstanceAfter] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'NoAccess',
            },
          },
        })
      const refs = await getAdditionalReferences([
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({ after: field }),
      ])

      expect(refs).toBeEmpty()
    })

    it('should create references for new field with access enabled', async () => {
      const [permissionSetInstanceBefore, profileInstanceBefore] =
        createTestInstances({
          fieldPermissions: {
            Account: {},
          },
        })
      const [permissionSetInstanceAfter, profileInstanceAfter] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'ReadWrite',
            },
          },
        })
      const refs = await getAdditionalReferences([
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({ after: field }),
      ])

      expect(refs).toEqual([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'fieldPermissions',
            'Account',
            'testField__c',
          ),
          target: field.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'fieldPermissions',
            'Account',
            'testField__c',
          ),
          target: field.elemID,
        },
      ])
    })

    it('should add references only for each detailed change in a modification', async () => {
      const [permissionSetInstanceBefore, profileInstanceBefore] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'Read',
            },
          },
        })
      const [permissionSetInstanceAfter, profileInstanceAfter] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'ReadWrite',
            },
          },
        })
      const fieldAfter = field.clone()
      fieldAfter.annotations.someAnn = 'val'

      const refs = await getAdditionalReferences([
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({ before: field, after: fieldAfter }),
      ])

      expect(refs).toEqual([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'fieldPermissions',
            'Account',
            'testField__c',
          ),
          target: field.elemID.createNestedID('someAnn'),
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'fieldPermissions',
            'Account',
            'testField__c',
          ),
          target: field.elemID.createNestedID('someAnn'),
        },
      ])
    })

    it('should not add references for addition profiles and permission sets', async () => {
      const [permissionSetInstanceAfter, profileInstanceAfter] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'ReadWrite',
            },
          },
        })
      const refs = await getAdditionalReferences([
        toChange({ after: permissionSetInstanceAfter }),
        toChange({ after: profileInstanceAfter }),
        toChange({ after: field }),
      ])

      expect(refs).toEqual([])
    })

    it('should not add references if not contained the field section', async () => {
      const [permissionSetInstanceBefore, profileInstanceBefore] =
        createTestInstances({
          fieldPermissions: {
            Account: {},
          },
        })
      const [permissionSetInstanceAfter, profileInstanceAfter] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              testField2__c: 'ReadWrite',
            },
          },
        })
      const refs = await getAdditionalReferences([
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({ after: field }),
      ])

      expect(refs).toEqual([])
    })

    it('should not add references if field does not have an api name', async () => {
      const [permissionSetInstanceBefore, profileInstanceBefore] =
        createTestInstances({
          fieldPermissions: {
            Account: {},
          },
        })
      const [permissionSetInstanceAfter, profileInstanceAfter] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              testField__c: 'ReadWrite',
            },
          },
        })
      delete field.annotations[API_NAME]
      const refs = await getAdditionalReferences([
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({ after: field }),
      ])

      expect(refs).toEqual([])
    })
  })
  describe('custom apps', () => {
    let customApp: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      customApp = new InstanceElement(
        'SomeApplication',
        createMetadataTypeElement('CustomApplication', {}),
        { [INSTANCE_FULL_NAME_FIELD]: 'SomeApplication' },
      )
    })

    it('should not create a reference to addition if neither default or visible', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          applicationVisibilities: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: false,
              visible: false,
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: customApp }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toBeEmpty()
    })

    it('should create a reference to addition if default', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          applicationVisibilities: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: true,
              visible: false,
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: customApp }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'applicationVisibilities',
            'SomeApplication',
          ),
          target: customApp.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'applicationVisibilities',
            'SomeApplication',
          ),
          target: customApp.elemID,
        },
      ])
    })

    it('should create a reference to addition if visible', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          applicationVisibilities: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: false,
              visible: true,
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: customApp }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'applicationVisibilities',
            'SomeApplication',
          ),
          target: customApp.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'applicationVisibilities',
            'SomeApplication',
          ),
          target: customApp.elemID,
        },
      ])
    })
    it('should create a reference to modification', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: false,
              visible: false,
            },
          },
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          applicationVisibilities: {
            SomeApplication: {
              application: 'SomeApplication',
              default: true,
              visible: true,
            },
          },
        })
      const customAppAfter = customApp.clone()
      customApp.annotations.someAnn = 'val'
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ before: customApp, after: customAppAfter }),
      ]
      const refs = await getAdditionalReferences(changes)

      expect(refs).toEqual([
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'applicationVisibilities',
            'SomeApplication',
            'default',
          ),
          target: customApp.elemID.createNestedID('someAnn'),
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'applicationVisibilities',
            'SomeApplication',
            'visible',
          ),
          target: customApp.elemID.createNestedID('someAnn'),
        },
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'applicationVisibilities',
            'SomeApplication',
            'default',
          ),
          target: customApp.elemID.createNestedID('someAnn'),
        },
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'applicationVisibilities',
            'SomeApplication',
            'visible',
          ),
          target: customApp.elemID.createNestedID('someAnn'),
        },
      ])
    })
  })
  describe('apex classes', () => {
    let apexClass: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      apexClass = new InstanceElement('SomeApexClass', mockTypes.ApexClass, {
        [INSTANCE_FULL_NAME_FIELD]: 'SomeApexClass',
      })
    })

    it('should not create a reference to addition if disabled', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          classAccesses: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: 'SomeApexClass',
              enabled: false,
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: apexClass }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toBeEmpty()
    })

    it('should create a reference to addition if enabled', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          classAccesses: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: 'SomeApexClass',
              enabled: true,
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: apexClass }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'classAccesses',
            'SomeApexClass',
          ),
          target: apexClass.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'classAccesses',
            'SomeApexClass',
          ),
          target: apexClass.elemID,
        },
      ])
    })

    it('should create a reference to modification', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: 'SomeApexClass',
              enabled: false,
            },
          },
        })

      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          classAccesses: {
            SomeApexClass: {
              apexClass: 'SomeApexClass',
              enabled: true,
            },
          },
        })

      const apexClassAfter = apexClass.clone()
      apexClass.annotations.someAnn = 'val'
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ before: apexClass, after: apexClassAfter }),
      ]
      const refs = await getAdditionalReferences(changes)

      expect(refs).toEqual([
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'classAccesses',
            'SomeApexClass',
            'enabled',
          ),
          target: apexClass.elemID.createNestedID('someAnn'),
        },
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'classAccesses',
            'SomeApexClass',
            'enabled',
          ),
          target: apexClass.elemID.createNestedID('someAnn'),
        },
      ])
    })
  })
  describe('flows', () => {
    let flow: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      flow = new InstanceElement('SomeFlow', mockTypes.Flow, {
        [INSTANCE_FULL_NAME_FIELD]: 'SomeFlow',
      })
    })

    it('should not create a reference to addition if disabled', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          flowAccesses: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: false,
              flow: 'SomeFlow',
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: flow }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toBeEmpty()
    })

    it('should create a reference to addition if enabled', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          flowAccesses: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: true,
              flow: 'SomeFlow',
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: flow }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'flowAccesses',
            'SomeFlow',
          ),
          target: flow.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'flowAccesses',
            'SomeFlow',
          ),
          target: flow.elemID,
        },
      ])
    })

    it('should create a reference to modification', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: false,
              flow: 'SomeFlow',
            },
          },
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          flowAccesses: {
            SomeFlow: {
              enabled: true,
              flow: 'SomeFlow',
            },
          },
        })
      const flowAfter = flow.clone()
      flow.annotations.someAnn = 'val'
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ before: flow, after: flowAfter }),
      ]
      const refs = await getAdditionalReferences(changes)

      expect(refs).toEqual([
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'flowAccesses',
            'SomeFlow',
            'enabled',
          ),
          target: flow.elemID.createNestedID('someAnn'),
        },
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'flowAccesses',
            'SomeFlow',
            'enabled',
          ),
          target: flow.elemID.createNestedID('someAnn'),
        },
      ])
    })
  })
  describe('layouts', () => {
    let layout: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      layout = new InstanceElement(
        'Account_Account_Layout@bs',
        mockTypes.Layout,
        { [INSTANCE_FULL_NAME_FIELD]: 'Account-Account Layout' },
      )
    })

    it('should create a reference to addition', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          layoutAssignments: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          layoutAssignments: {
            'Account_Account_Layout@bs': [
              {
                layout: 'Account-Account Layout',
              },
            ],
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: layout }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toHaveLength(2)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'layoutAssignments',
            'Account_Account_Layout@bs',
          ),
          target: layout.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'layoutAssignments',
            'Account_Account_Layout@bs',
          ),
          target: layout.elemID,
        },
      ])
    })

    it('should create a reference to modification', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          layoutAssignments: {
            'Account_Account_Layout@bs': [
              {
                layout: 'Account-Account Other Layout',
              },
            ],
          },
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          layoutAssignments: {
            'Account_Account_Layout@bs': [
              {
                layout: 'Account-Account Layout',
              },
            ],
          },
        })
      const layoutAfter = layout.clone()
      layout.annotations.someAnn = 'val'
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ before: layout, after: layoutAfter }),
      ]
      const refs = await getAdditionalReferences(changes)

      expect(refs).toEqual([
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'layoutAssignments',
            'Account_Account_Layout@bs',
            '0',
            'layout',
          ),
          target: layout.elemID.createNestedID('someAnn'),
        },
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'layoutAssignments',
            'Account_Account_Layout@bs',
            '0',
            'layout',
          ),
          target: layout.elemID.createNestedID('someAnn'),
        },
      ])
    })

    describe('with recordType reference', () => {
      let recordTypes: InstanceElement[]
      beforeEach(() => {
        recordTypes = [
          new InstanceElement('SomeRecordType', mockTypes.RecordType, {
            [INSTANCE_FULL_NAME_FIELD]: 'SomeRecordType',
          }),
          new InstanceElement('SomeOtherRecordType', mockTypes.RecordType, {
            [INSTANCE_FULL_NAME_FIELD]: 'SomeOtherRecordType',
          }),
        ]
      })

      it('should create recordType references on addition', async () => {
        const [profileInstanceBefore, permissionSetInstanceBefore] =
          createTestInstances({
            layoutAssignments: {},
          })
        const [profileInstanceAfter, permissionSetInstanceAfter] =
          createTestInstances({
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
        changes = [
          toChange({
            before: profileInstanceBefore,
            after: profileInstanceAfter,
          }),
          toChange({
            before: permissionSetInstanceBefore,
            after: permissionSetInstanceAfter,
          }),
          toChange({ after: layout }),
          ...recordTypes.map((recordType) => toChange({ after: recordType })),
        ]

        const refs = await getAdditionalReferences(changes)
        expect(refs).toIncludeAllPartialMembers([
          {
            source: profileInstanceAfter.elemID.createNestedID(
              'layoutAssignments',
              'Account_Account_Layout@bs',
            ),
            target: recordTypes[0].elemID,
          },
          {
            source: profileInstanceAfter.elemID.createNestedID(
              'layoutAssignments',
              'Account_Account_Layout@bs',
            ),
            target: recordTypes[1].elemID,
          },
        ])
      })

      it('should create recordType references on modification', async () => {
        const [profileInstanceBefore, permissionSetInstanceBefore] =
          createTestInstances({
            layoutAssignments: {
              'Account_Account_Layout@bs': [
                {
                  layout: 'Account-Account Layout',
                  recordType: 'SomeRecordType2',
                },
                {
                  layout: 'Account-Account Layout',
                  recordType: 'SomeOtherRecordType2',
                },
              ],
            },
          })
        const [profileInstanceAfter, permissionSetInstanceAfter] =
          createTestInstances({
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
        const recordTypesAfter = recordTypes.map((recordType) =>
          recordType.clone(),
        )
        recordTypesAfter.forEach((recordType) => {
          recordType.annotations.someAnn = 'val'
        })
        const layoutAfter = layout.clone()
        layout.annotations.someAnn = 'val'
        changes = [
          toChange({
            before: profileInstanceBefore,
            after: profileInstanceAfter,
          }),
          toChange({
            before: permissionSetInstanceBefore,
            after: permissionSetInstanceAfter,
          }),
          toChange({ before: layout, after: layoutAfter }),
          ..._.zip(recordTypes, recordTypesAfter).map(([before, after]) =>
            toChange({ before, after }),
          ),
        ]
        const refs = await getAdditionalReferences(changes)

        expect(refs).toIncludeAllPartialMembers([
          {
            source: profileInstanceAfter.elemID.createNestedID(
              'layoutAssignments',
              'Account_Account_Layout@bs',
              '0',
              'recordType',
            ),
            target: recordTypes[0].elemID.createNestedID('someAnn'),
          },
          {
            source: profileInstanceAfter.elemID.createNestedID(
              'layoutAssignments',
              'Account_Account_Layout@bs',
              '1',
              'recordType',
            ),
            target: recordTypes[1].elemID.createNestedID('someAnn'),
          },
        ])
      })
    })
  })

  describe('objects', () => {
    let customObject: ObjectType
    let changes: Change[]

    beforeEach(() => {
      customObject = createCustomObjectType('Account', {})
    })

    it('should not create a reference to addition if all permissions are disabled', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          objectPermissions: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
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
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: customObject }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toBeEmpty()
    })
    it('should create a reference to addition if any permission is enabled', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          objectPermissions: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
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
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: customObject }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'objectPermissions',
            'Account',
          ),
          target: customObject.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'objectPermissions',
            'Account',
          ),
          target: customObject.elemID,
        },
      ])
    })

    it('should create a reference to modification', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          objectPermissions: {
            Account: {
              allowCreate: false,
              allowDelete: true,
              allowEdit: true,
              allowRead: true,
              modifyAllRecords: false,
              object: 'Account',
              viewAllRecords: false,
            },
          },
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
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
      const customObjectAfter = customObject.clone()
      customObjectAfter.annotations.someAnn = 'val'
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ before: customObject, after: customObjectAfter }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toEqual([
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'objectPermissions',
            'Account',
            'allowCreate',
          ),
          target: customObject.elemID.createNestedID('attr', 'someAnn'),
        },
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'objectPermissions',
            'Account',
            'allowCreate',
          ),
          target: customObject.elemID.createNestedID('attr', 'someAnn'),
        },
      ])
    })

    it('should create a reference to fields', async () => {
      customObject = createCustomObjectType('Account', {
        fields: {
          someField: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [API_NAME]: 'Account.someField',
            },
          },
        },
      })
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          fieldPermissions: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              someField: 'Read',
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: customObject }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'fieldPermissions',
            'Account',
          ),
          target: customObject.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'fieldPermissions',
            'Account',
          ),
          target: customObject.elemID,
        },
      ])
    })

    it('should not create a reference to fields if fields have default permissions', async () => {
      customObject = createCustomObjectType('Account', {
        fields: {
          someField: {
            refType: BuiltinTypes.STRING,
            annotations: {
              [API_NAME]: 'Account.someField',
            },
          },
        },
      })
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          fieldPermissions: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          fieldPermissions: {
            Account: {
              someField: 'NoAccess',
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: customObject }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toEqual([])
    })
  })

  describe('Apex pages', () => {
    let apexPage: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      apexPage = new InstanceElement('SomeApexPage', mockTypes.ApexPage, {
        [INSTANCE_FULL_NAME_FIELD]: 'SomeApexPage',
      })
    })

    it('should create a reference to addition if enabled', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          pageAccesses: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: 'SomeApexPage',
              enabled: true,
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: apexPage }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'pageAccesses',
            'SomeApexPage',
          ),
          target: apexPage.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'pageAccesses',
            'SomeApexPage',
          ),
          target: apexPage.elemID,
        },
      ])
    })

    it('should not create a reference if not enabled', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          pageAccesses: {},
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: 'SomeApexPage',
              enabled: false,
            },
          },
        })
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: apexPage }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toBeEmpty()
    })
    it('should create a reference to modification', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: 'SomeApexPage',
              enabled: true,
            },
          },
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
          pageAccesses: {
            SomeApexPage: {
              apexPage: 'SomeApexPage',
              enabled: false,
            },
          },
        })
      const apexPageAfter = apexPage.clone()
      apexPageAfter.annotations.someAnn = 'val'
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ before: apexPage, after: apexPageAfter }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'pageAccesses',
            'SomeApexPage',
            'enabled',
          ),
          target: apexPage.elemID.createNestedID('someAnn'),
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'pageAccesses',
            'SomeApexPage',
            'enabled',
          ),
          target: apexPage.elemID.createNestedID('someAnn'),
        },
      ])
    })
  })

  describe('record types', () => {
    let recordType: InstanceElement
    let changes: Change[]

    beforeEach(() => {
      recordType = new InstanceElement(
        'Case_SomeCaseRecordType',
        mockTypes.RecordType,
        { [INSTANCE_FULL_NAME_FIELD]: 'Case.SomeCaseRecordType' },
      )
    })

    it('should not create a reference to addition if neither default nor visible', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          recordTypeVisibilities: {
            Case: {},
          },
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
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
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: recordType }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toBeEmpty()
    })

    it('should create a reference to addition if default', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          recordTypeVisibilities: {
            Case: {},
          },
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
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
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: recordType }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'recordTypeVisibilities',
            'Case',
            'SomeCaseRecordType',
          ),
          target: recordType.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'recordTypeVisibilities',
            'Case',
            'SomeCaseRecordType',
          ),
          target: recordType.elemID,
        },
      ])
    })

    it('should create a reference to addition if visible', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
          recordTypeVisibilities: {
            Case: {},
          },
        })
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
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
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ after: recordType }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'recordTypeVisibilities',
            'Case',
            'SomeCaseRecordType',
          ),
          target: recordType.elemID,
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'recordTypeVisibilities',
            'Case',
            'SomeCaseRecordType',
          ),
          target: recordType.elemID,
        },
      ])
    })
    it('should create a reference to modification', async () => {
      const [profileInstanceBefore, permissionSetInstanceBefore] =
        createTestInstances({
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
      const [profileInstanceAfter, permissionSetInstanceAfter] =
        createTestInstances({
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
      const recordTypeAfter = recordType.clone()
      recordTypeAfter.annotations.someAnn = 'val'
      changes = [
        toChange({
          before: profileInstanceBefore,
          after: profileInstanceAfter,
        }),
        toChange({
          before: permissionSetInstanceBefore,
          after: permissionSetInstanceAfter,
        }),
        toChange({ before: recordType, after: recordTypeAfter }),
      ]
      const refs = await getAdditionalReferences(changes)
      expect(refs).toIncludeAllPartialMembers([
        {
          source: permissionSetInstanceAfter.elemID.createNestedID(
            'recordTypeVisibilities',
            'Case',
            'SomeCaseRecordType',
            'default',
          ),
          target: recordType.elemID.createNestedID('someAnn'),
        },
        {
          source: profileInstanceAfter.elemID.createNestedID(
            'recordTypeVisibilities',
            'Case',
            'SomeCaseRecordType',
            'default',
          ),
          target: recordType.elemID.createNestedID('someAnn'),
        },
      ])
    })
  })
})
