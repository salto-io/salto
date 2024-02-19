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
import { ObjectType, ElemID, InstanceElement, BuiltinTypes, ReferenceExpression } from '@salto-io/adapter-api'
// eslint-disable-next-line
import { toInstance } from '../../../src/elements/ducktype'
import { RECORDS_PATH } from '../../../src/elements/constants'

/* eslint-disable camelcase */
const ADAPTER_NAME = 'myAdapter'

const type = new ObjectType({
  elemID: new ElemID(ADAPTER_NAME, 'bla'),
  // not exhaustive - only has the field ids that are needed for the tests
  fields: {
    id: { refType: BuiltinTypes.NUMBER },
    api_collection_id: { refType: BuiltinTypes.NUMBER },
    field_with_complex_type: {
      refType: BuiltinTypes.UNKNOWN,
    }, // incorrect type
  },
})

describe('ducktype_instance_elements', () => {
  describe('toInstance', () => {
    const entry = {
      id: 54775,
      api_collection_id: 22,
      flow_id: 890,
      name: 'some other name',
      field_with_complex_type: {
        number: 53,
        nested_type: {
          val: 'agds',
          another_val: 'dgadgasg',
        },
      },
    }
    it('should generate instance based on response', async () => {
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement('some_other_name@s', type, entry))).toBeTruthy()
      expect(inst?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', 'some_other_name'])
    })
    it('should use fileNameFields for path when available', async () => {
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
            fileNameFields: ['id', 'name'],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement('some_other_name@s', type, entry))).toBeTruthy()
      expect(inst?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', '54775_some_other_name'])
    })
    it('should convert number id fields to string', async () => {
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name', 'id'],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement('some_other_name_54775@ssu', type, entry))).toBeTruthy()
      expect(inst?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', 'some_other_name_54775'])
    })
    it('should escape id part when it only contains digits', async () => {
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['id'],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement('54775@', type, entry))).toBeTruthy()
      expect(inst?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', '54775'])
    })
    it('should include parent name when nestName is true', async () => {
      const parent = new InstanceElement('abc', type, {})
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
        nestName: true,
        parent,
      })
      expect(inst).toBeDefined()
      expect(
        inst?.isEqual(
          new InstanceElement('abc__some_other_name@uuss', type, entry, undefined, {
            _parent: [new ReferenceExpression(parent.elemID)],
          }),
        ),
      ).toBeTruthy()
      expect(inst?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', 'abc__some_other_name'])
    })
    it('should omit fields from the top level', async () => {
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
            fieldsToOmit: [{ fieldName: 'field_with_complex_type' }, { fieldName: 'id', fieldType: 'number' }],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
      })
      expect(inst).toBeDefined()
      expect(
        inst?.isEqual(new InstanceElement('some_other_name@s', type, _.omit(entry, 'field_with_complex_type', 'id'))),
      ).toBeTruthy()
      expect(inst?.isEqual(new InstanceElement('some_other_name@s', type, entry))).toBeFalsy()
    })
    it('should not omit fields when fieldType is specified and does not match', async () => {
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
            fieldsToOmit: [{ fieldName: 'field_with_complex_type' }, { fieldName: 'id', fieldType: 'string' }],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
      })
      expect(inst).toBeDefined()
      expect(
        inst?.isEqual(new InstanceElement('some_other_name@s', type, _.omit(entry, 'field_with_complex_type'))),
      ).toBeTruthy()
      expect(inst?.value.id).toBeDefined()
    })
    it('should use default name if name field is not found in entry', async () => {
      const e = _.omit(entry, 'name')
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry: e,
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement('abc', type, e))).toBeTruthy()
    })
    it('should not omit nested fields', async () => {
      const e = {
        field_with_complex_type: {
          id: 54775,
          number: 53,
        },
      }
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
            fieldsToOmit: [{ fieldName: 'id' }],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry: {
          id: 54775,
          ...e,
        },
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement('abc', type, e))).toBeTruthy()
    })
    it('should omit null field values', async () => {
      const e = {
        a: null,
        field_with_complex_type: {
          id: 54775,
          number: 53,
          null: null,
        },
      }
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry: e,
      })
      expect(inst).toBeDefined()
      expect(
        inst?.isEqual(
          new InstanceElement('abc', type, {
            field_with_complex_type: {
              id: 54775,
              number: 53,
            },
          }),
        ),
      ).toBeTruthy()
    })
    it('should not generate instance if value is empty', async () => {
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry: {},
      })
      expect(inst).toBeUndefined()
    })
    it('should use elemIdGetter ', async () => {
      const instanceName = 'test'
      const inst = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
            serviceIdField: 'id',
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
        getElemIdFunc: (adapterName, serviceIds, name) => {
          if (Number(serviceIds.id) === entry.id) {
            return new ElemID(adapterName, type.elemID.typeName, 'instance', instanceName)
          }
          return new ElemID(adapterName, type.elemID.typeName, 'instance', name)
        },
      })
      expect(inst).toBeDefined()
      expect(inst?.isEqual(new InstanceElement(instanceName, type, entry))).toBeTruthy()
      expect(inst?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', instanceName])
    })
    it('should convert name if nameMapping exists', async () => {
      entry.name = 'CaPSlOCK NaMe'
      const inst1 = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
            nameMapping: 'lowercase',
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
      })
      const inst2 = await toInstance({
        type,
        transformationConfigByType: {
          bla: {
            idFields: ['name'],
            nameMapping: 'uppercase',
          },
        },
        transformationDefaultConfig: {
          idFields: ['somethingElse'],
        },
        defaultName: 'abc',
        entry,
      })
      expect(inst1?.elemID.getFullName()).toEqual('myAdapter.bla.instance.capslock_name@s')
      expect(inst1?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', 'capslock_name'])
      expect(inst2?.elemID.getFullName()).toEqual('myAdapter.bla.instance.CAPSLOCK_NAME@S')
      expect(inst2?.path).toEqual([ADAPTER_NAME, RECORDS_PATH, 'bla', 'CAPSLOCK_NAME'])
    })
  })
})
