/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Element, ElemID, ObjectType, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { SALESFORCE } from '../../src/constants'
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/remove_unix_time_zero'
import { defaultFilterContext } from '../utils'

const UNIX_TIME_ZERO_STRING = '1970-01-01T00:00:00.000Z'
const RANDOM_TIME_STRING = '2023-01-05T12:13:14.000Z'

const mockObjId = new ElemID(SALESFORCE, 'MockObject')
const mockTypeWithUnixTimeZeroBothFields = new ObjectType({
  elemID: mockObjId,
  annotations: {
    _created_at: UNIX_TIME_ZERO_STRING,
    _changed_at: UNIX_TIME_ZERO_STRING,
  },
})

const mockTypeWithUnixTimeZeroCreatedAtField = new ObjectType({
  elemID: mockObjId,
  annotations: {
    _created_at: UNIX_TIME_ZERO_STRING,
    _changed_at: RANDOM_TIME_STRING,
  },
})

const mockTypeWithUnixTimeZeroChangedAtField = new ObjectType({
  elemID: mockObjId,
  annotations: {
    _created_at: RANDOM_TIME_STRING,
    _changed_at: UNIX_TIME_ZERO_STRING,
  },
})

const mockTypeWithoutUnixTimeZero = new ObjectType({
  elemID: mockObjId,
  annotations: {
    _created_at: RANDOM_TIME_STRING,
    _changed_at: RANDOM_TIME_STRING,
  },
})

let testElements: Element[]

beforeEach(() => {
  testElements = [
    mockTypeWithUnixTimeZeroBothFields.clone(),
    mockTypeWithUnixTimeZeroCreatedAtField.clone(),
    mockTypeWithUnixTimeZeroChangedAtField.clone(),
    mockTypeWithoutUnixTimeZero.clone(),
  ]
})

describe('removeUnixTimeZero', () => {
    type FilterType = FilterWith<'onFetch'>
    let filter: FilterType
    beforeEach(async () => {
      filter = filterCreator({ config: defaultFilterContext }) as FilterType
      await filter.onFetch(testElements)
    })

    describe('on fetch', () => {
      it('should remove invalid unix time 0 annotations', () => {
        const testValueBothInvalidFields = testElements[0] as ObjectType
        expect(testValueBothInvalidFields.annotations).not.toHaveProperty(CORE_ANNOTATIONS.CHANGED_AT)
        expect(testValueBothInvalidFields.annotations).not.toHaveProperty(CORE_ANNOTATIONS.CREATED_AT)

        const testValueInvalidCreatedAt = testElements[1] as ObjectType
        expect(testValueInvalidCreatedAt.annotations).not.toHaveProperty(CORE_ANNOTATIONS.CREATED_AT)

        const testValueInvalidChangedAt = testElements[2] as ObjectType
        expect(testValueInvalidChangedAt.annotations).not.toHaveProperty(CORE_ANNOTATIONS.CHANGED_AT)
      })

      it('should not remove annotations with valid time', () => {
        const testValueBothValidFields = testElements[3] as ObjectType
        expect(testValueBothValidFields.annotations).toHaveProperty(CORE_ANNOTATIONS.CREATED_AT)
        expect(testValueBothValidFields.annotations).toHaveProperty(CORE_ANNOTATIONS.CHANGED_AT)

        const testValueInvalidCreatedAt = testElements[1] as ObjectType
        expect(testValueInvalidCreatedAt.annotations).toHaveProperty(CORE_ANNOTATIONS.CHANGED_AT)

        const testValueInvalidChangedAt = testElements[2] as ObjectType
        expect(testValueInvalidChangedAt.annotations).toHaveProperty(CORE_ANNOTATIONS.CREATED_AT)
      })
    })
})
