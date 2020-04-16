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
import {
  ObjectType, ElemID, Field, BuiltinTypes, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import { makeFilter, generateAllMissingFields, RawMissingFieldData } from '../../src/filters/missing_fields'

describe('missing fields filter', () => {
  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      existing: new Field(mockObjId, 'existing', BuiltinTypes.STRING),
    },
  })
  const complexType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'complex_type'),
    annotations: { marker: 'here' },
  })

  const { client } = mockClient()
  const filter = makeFilter({
    [mockObjId.getFullName()]: [
      {
        name: 'lst',
        type: BuiltinTypes.STRING,
        annotations: { dummy: true },
        isList: true,
      },
      {
        name: 'complex',
        type: complexType.elemID,
      },
      {
        name: 'missing',
        type: new ElemID('test', 'none'),
      },
    ],
  })({ client }) as FilterWith<'onFetch'>

  let testElements: ObjectType[]

  beforeEach(() => {
    testElements = [
      mockType.clone(),
      complexType,
    ]
  })

  describe('on fetch', () => {
    beforeEach(() => filter.onFetch(testElements))

    it('should add primitive list fields', () => {
      const [testType] = testElements
      expect(testType.fields.lst).toBeDefined()
      expect(testType.fields.lst.annotations).toEqual({ dummy: true })
      expect(testType.fields.lst.type).toEqual(new ListType(BuiltinTypes.STRING))
    })

    it('should add fields by type name', () => {
      const [testType] = testElements
      expect(testType.fields.complex).toBeDefined()
      expect(testType.fields.complex.annotations).toEqual({})
      expect(testType.fields.complex.type).toEqual(complexType)
    })

    it('should keep existing fields unchanged', () => {
      const [testType] = testElements
      expect(testType.fields.existing).toEqual(mockType.fields.existing)
    })

    it('should quietly omit fields with missing types', () => {
      const [testType] = testElements
      expect(testType.fields).not.toHaveProperty('missing')
    })
  })
  describe('Json parsing functions', () => {
    it('Should parse JSON builtin types', () => {
      const rawMissingFields = [{ id: 'foo',
        fields: [{
          name: 'bar0',
          type: 'STRING',
        },
        {
          name: 'bar1',
          type: 'NUMBER',
        },
        {
          name: 'bar2',
          type: 'JSON',
        },
        {
          name: 'bar3',
          type: 'BOOLEAN',
        },
        {
          name: 'bar4',
          type: 'SERVICE_ID',
          annotations: {
            _values: ['test0', 'test1'],
            _restrictions: {
              _enforceValue: true,
            },
          },
        }] },
      {
        id: 'foo',
        fields: [{
          boolean: ['enable1', 'enable2', 'enable3'],
        }],
      },
      ]
      const data = generateAllMissingFields(rawMissingFields as RawMissingFieldData[])
      expect((data[0].id as ElemID).typeName).toEqual('foo')
      expect(data[0].fields[0].name).toEqual('bar0')
      expect(data[0].fields[0].type).toEqual(BuiltinTypes.STRING)
      expect(data[0].fields[1].name).toEqual('bar1')
      expect(data[0].fields[1].type).toEqual(BuiltinTypes.NUMBER)
      expect(data[0].fields[2].name).toEqual('bar2')
      expect(data[0].fields[2].type).toEqual(BuiltinTypes.JSON)
      expect(data[0].fields[3].name).toEqual('bar3')
      expect(data[0].fields[3].type).toEqual(BuiltinTypes.BOOLEAN)
      expect(data[0].fields[4].name).toEqual('bar4')
      expect(data[0].fields[4].type).toEqual(BuiltinTypes.SERVICE_ID)
      expect(
        data[0].fields[4].annotations?._restrictions?._enforceValue
      ).toEqual(true)
      expect(data[0].fields[4].annotations?._values).toEqual(['test0', 'test1'])
      expect(data[1].fields[0].name).toEqual('enable1')
      expect(data[1].fields[0].type).toEqual(BuiltinTypes.BOOLEAN)
      expect(data[1].fields[1].name).toEqual('enable2')
      expect(data[1].fields[1].type).toEqual(BuiltinTypes.BOOLEAN)
      expect(data[1].fields[2].name).toEqual('enable3')
      expect(data[1].fields[2].type).toEqual(BuiltinTypes.BOOLEAN)
    })
    it('should parse JSON not builtin types', () => {
      const rawMissingFields = [{
        id: 'test',
        fields: [{
          name: 'bar0',
          type: 'TestType',
        }],
      }]
      const data = generateAllMissingFields(rawMissingFields as RawMissingFieldData[])
      expect((data[0].id as ElemID).typeName).toEqual('test')
      expect(data[0].fields[0].name).toEqual('bar0')
      expect((data[0].fields[0].type as ElemID).typeName).toEqual('TestType')
    })
  })
})
