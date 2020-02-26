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
import { makeFilter } from '../../src/filters/missing_fields'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

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
        type: new ListType(BuiltinTypes.STRING),
        annotations: { dummy: true },
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
})
