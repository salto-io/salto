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
  ObjectType, ElemID, BuiltinTypes,
} from '@salto-io/adapter-api'
import { makeFilter } from '../../src/filters/remove_fields'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('remove fields filter', () => {
  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      existing: { type: BuiltinTypes.STRING },
      test: { type: BuiltinTypes.STRING },
    },
  })
  const anotherMockObjId = new ElemID(constants.SALESFORCE, 'anotherType')
  const anotherMockType = new ObjectType({
    elemID: anotherMockObjId,
    fields: {
      test: { type: BuiltinTypes.STRING },
    },
  })

  const { client } = mockClient()
  const filter = makeFilter({
    [mockObjId.getFullName()]: ['test'],
  })({ client, config: {} }) as FilterWith<'onFetch'>

  let testElements: ObjectType[]

  beforeEach(() => {
    testElements = [
      mockType.clone(),
      anotherMockType.clone(),
    ]
  })

  describe('on fetch', () => {
    beforeEach(() => filter.onFetch(testElements))

    it('should remove field', () => {
      const [testType] = testElements
      expect(testType.fields.existing).toBeDefined()
      expect(testType.fields.existing.isEqual(mockType.fields.existing)).toBeTruthy()
      expect(testType.fields.test).toBeUndefined()
    })

    it('should not remove field when the ID is not of the right object', () => {
      const testType = testElements[1]
      expect(testType.fields.test).toBeDefined()
      expect(testType.fields.test.isEqual(anotherMockType.fields.test)).toBeTruthy()
    })
  })
})
