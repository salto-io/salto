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
import { InstanceElement } from '@salto-io/adapter-api'
import { Record } from 'node-suitetalk'
import { createInstanceElement, toNetsuiteRecord } from '../src/transformer'
import { Types } from '../src/types'
import {
  ATTRIBUTES, ENTITY_CUSTOM_FIELD, INTERNAL_ID, NETSUITE, RECORDS_PATH, SCRIPT_ID,
} from '../src/constants'
import { NetsuiteRecord } from '../src/client/client'

describe('Transformer', () => {
  const entityCustomFieldRecord = {
    label: 'My Custom Field Record',
    bla: false,
    [ATTRIBUTES]: {
      [INTERNAL_ID]: '111',
      'xsi:type': 'setupCustom:EntityCustomField',
    },
    owner: {
      [ATTRIBUTES]: {
        [INTERNAL_ID]: '222',
        'xsi:type': 'setupCustom:EntityCustomField',
      },
      name: 'I am the owner',
    },
    roleAccessList: {
      roleAccess: [
        {
          role: {
            [ATTRIBUTES]: {
              internalId: '6',
            },
            name: 'Bookkeeper',
          },
          accessLevel: '_view',
          searchLevel: '_edit',
        },
        {
          role: {
            [ATTRIBUTES]: {
              internalId: '50',
            },
            name: 'Buyer',
          },
          accessLevel: '_view',
          searchLevel: '_run',
        },
      ],
    },
  }

  describe('createInstanceElement func', () => {
    let inst: InstanceElement
    beforeAll(() => {
      inst = createInstanceElement(entityCustomFieldRecord,
        Types.customizationTypes[ENTITY_CUSTOM_FIELD])
      expect(inst).toBeDefined()
    })
    it('should omit values that are not stated in the type', async () => {
      expect(inst.value).not.toHaveProperty('bla')
    })

    it('should flatten ATTRIBUTES', async () => {
      expect(inst.value).not.toHaveProperty(ATTRIBUTES)
      expect(inst.value[INTERNAL_ID]).toEqual('111')
    })

    it('should flatten ATTRIBUTES of inner value', async () => {
      const { owner } = inst.value
      expect(owner).not.toHaveProperty(ATTRIBUTES)
      expect(owner[INTERNAL_ID]).toEqual('222')
      expect(owner.name).toEqual('I am the owner')
    })

    it('should transform inner list fields', async () => {
      const { roleAccessList } = inst.value
      expect(roleAccessList).toEqual({
        roleAccess: [
          {
            role: {
              name: 'Bookkeeper',
              internalId: '6',
            },
            accessLevel: '_view',
            searchLevel: '_edit',
          },
          {
            role: {
              name: 'Buyer',
              internalId: '50',
            },
            accessLevel: '_view',
            searchLevel: '_run',
          },
        ],
      })
    })

    it('should transform primitive values ATTRIBUTES of inner value', async () => {
      expect(inst.value.label).toEqual('My Custom Field Record')
    })

    it('should create instance with correct name', async () => {
      expect(inst.elemID.name).toEqual('My_Custom_Field_Record')
    })
    it('should create correct path', async () => {
      expect(inst.path)
        .toEqual([NETSUITE, RECORDS_PATH, ENTITY_CUSTOM_FIELD, 'My_Custom_Field_Record'])
    })
  })

  describe('toNetsuiteRecord func', () => {
    let result: NetsuiteRecord
    beforeEach(() => {
      const instance = new InstanceElement('test', Types.customizationTypes[ENTITY_CUSTOM_FIELD], {
        label: 'Labelo',
        [INTERNAL_ID]: '123',
        [SCRIPT_ID]: 'my_script_id',
        owner: {
          [INTERNAL_ID]: '-5',
          name: 'Owner Name',
        },
        roleAccessList: {
          roleAccess: [
            {
              role: {
                name: 'Buyer',
                internalId: '50',
              },
              accessLevel: '_view',
              searchLevel: '_run',
            },
            {
              role: {
                name: 'Bookkeeper',
                internalId: '6',
              },
              accessLevel: '_view',
              searchLevel: '_edit',
            },
          ],
        },
      })
      result = toNetsuiteRecord(instance)
    })

    it('should transform INTERNAL_ID', () => {
      expect(result.internalId).toEqual('123')
    })

    it('should transform body fields', () => {
      const createExpectedListField = (): Record.Fields.List => {
        const expectedList = new Record.Fields.List('CustomFieldRoleAccessList', 'roleAccessList')
        const roleRecordRef = new Record.Fields.RecordRef('role')
        roleRecordRef.internalId = '50'
        const bookkeeperRecordRef = new Record.Fields.RecordRef('role')
        bookkeeperRecordRef.internalId = '6'
        const expectedListItem1 = new Record.Fields.Line('CustomFieldRoleAccess', 'roleAccess')
        expectedListItem1.bodyFieldList = [
          roleRecordRef,
          new Record.Fields.PrimitiveField('accessLevel', '_view'),
          new Record.Fields.PrimitiveField('searchLevel', '_run'),
        ]
        const expectedListItem2 = new Record.Fields.Line('CustomFieldRoleAccess', 'roleAccess')
        expectedListItem2.bodyFieldList = [
          bookkeeperRecordRef,
          new Record.Fields.PrimitiveField('accessLevel', '_view'),
          new Record.Fields.PrimitiveField('searchLevel', '_edit'),
        ]
        expectedList.list = [expectedListItem1, expectedListItem2]
        return expectedList
      }

      expect(result.bodyFieldList).toHaveLength(4)
      const expectedListField = createExpectedListField()
      const ownerRecordRef = new Record.Fields.RecordRef('owner')
      ownerRecordRef.internalId = '-5'
      expect(result.bodyFieldList).toMatchObject([
        new Record.Fields.PrimitiveField('label', 'Labelo'),
        new Record.Fields.PrimitiveField('scriptId', 'my_script_id'),
        ownerRecordRef,
        expectedListField,
      ])
    })
  })
})
