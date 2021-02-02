/*
*                      Copyright 2021 Salto Labs Ltd.
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
/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ObjectType, ElemID, BuiltinTypes, MapType, ListType } from '@salto-io/adapter-api'
import { findNestedField, returnFullEntry } from '../../../src/elements/ducktype/field_finder'

const ADAPTER_NAME = 'myAdapter'

const sampleType = new ObjectType({
  elemID: new ElemID(ADAPTER_NAME, 'bla'),
  fields: {
    str: { type: BuiltinTypes.STRING },
    nested: {
      type: new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'nested'),
        fields: {
          str: { type: BuiltinTypes.STRING },
          list: { type: new ListType(BuiltinTypes.NUMBER) },
        },
      }),
    },
    nestedMap: { type: new MapType(BuiltinTypes.STRING) },
  },
})

describe('ducktype_field_finder', () => {
  describe('findNestedField', () => {
    it('should return undefined when more than one field satisfies the requirements', () => {
      const fieldDetails = findNestedField(sampleType)
      expect(fieldDetails).toBeUndefined()
    })
    it('should return inner type when the matching field is a list', () => {
      const fieldDetails = findNestedField(sampleType, ['str', 'nestedMap'])
      expect(fieldDetails).toEqual({
        field: sampleType.fields.nested,
        type: sampleType.fields.nested.type,
      })
    })
    it('should return undefined when the only relevant field is a primitive type', () => {
      const fieldDetails = findNestedField(sampleType, ['nested', 'nestedMap'])
      expect(fieldDetails).toBeUndefined()
    })
    it('should return undefined when the only relevant field is a map type', () => {
      // this test is here to verify this case is handled gracefully.
      // if this becomes a real scenario, it should be changed according to the chosen structure.
      const fieldDetails = findNestedField(sampleType, ['str', 'nested'])
      expect(fieldDetails).toBeUndefined()
    })
    it('should return undefined when the object is empty', () => {
      const type = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'bla'), fields: {} })
      const fieldDetails = findNestedField(type)
      expect(fieldDetails).toBeUndefined()
    })
  })

  describe('returnFullEntry', () => {
    it('should return always return undefined', () => {
      expect(returnFullEntry(sampleType)).toBeUndefined()
      expect(returnFullEntry(sampleType, ['str', 'nested'])).toBeUndefined()
      expect(returnFullEntry(sampleType, ['str', 'nested', 'nestedMap'])).toBeUndefined()
      expect(returnFullEntry(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'bla'),
        fields: {},
      }))).toBeUndefined()
    })
  })
})
