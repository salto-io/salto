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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/add_restriction'
import { createFilterCreatorParams } from '../utils'

describe('custom field option restriction filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const typeName = 'ticket_field__custom_field_options'
  const objTypeNoValue = new ObjectType({ elemID: new ElemID(ZENDESK, typeName) })
  const objTypeWithValue = new ObjectType({ elemID: new ElemID(ZENDESK, typeName) })
  objTypeWithValue.fields.value = new Field(
    objTypeWithValue,
    'value',
    BuiltinTypes.STRING,
  )
  const objTypeWithTwoFields = new ObjectType({ elemID: new ElemID(ZENDESK, typeName) })
  objTypeWithTwoFields.fields.value = new Field(
    objTypeWithTwoFields,
    'value',
    BuiltinTypes.STRING,
  )
  objTypeWithTwoFields.fields.other = new Field(
    objTypeWithTwoFields,
    'other',
    BuiltinTypes.STRING,
  )
  beforeEach(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('onFetch', () => {
    it('should add a regex restriction to the value field when exists', async () => {
      const elements = [objTypeWithValue].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements).toHaveLength(1)
      expect(elements[0].fields.value.annotations[CORE_ANNOTATIONS.RESTRICTION].regex)
        .toBeDefined()
      expect(elements[0].fields.value.annotations[CORE_ANNOTATIONS.RESTRICTION].regex)
        .toEqual('^[0-9A-Za-z-_.\\/~:^]+$')
    })
    it('should add a regex restriction only to the value field and not to the other field', async () => {
      const elements = [objTypeWithTwoFields].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements).toHaveLength(1)
      expect(elements[0].fields.value.annotations[CORE_ANNOTATIONS.RESTRICTION].regex)
        .toEqual('^[0-9A-Za-z-_.\\/~:^]+$')
      expect(elements[0]
        .fields.other.annotations[CORE_ANNOTATIONS.RESTRICTION]).not.toBeDefined()
    })
    it('should not add a regex restriction to the value field when the field does not exists', async () => {
      const elements = [objTypeNoValue].map(e => e.clone())
      await filter.onFetch(elements)
      expect(elements).toHaveLength(1)
      expect(elements[0]
        .fields.value?.annotations[CORE_ANNOTATIONS.RESTRICTION].regex).not.toBeDefined()
    })
  })
})
