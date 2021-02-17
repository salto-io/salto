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
import { findNestedField, returnFullEntry } from '../../../src/elements/ducktype'
import { createRefToElmWithValue } from '../../../src/utils'

const ADAPTER_NAME = 'myAdapter'

const nestedType = new ObjectType({
  elemID: new ElemID(ADAPTER_NAME, 'nested'),
  fields: {
    str: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    list: { refType: createRefToElmWithValue(new ListType(BuiltinTypes.NUMBER)) },
  },
})

const sampleType = new ObjectType({
  elemID: new ElemID(ADAPTER_NAME, 'bla'),
  fields: {
    str: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    nested: {
      refType: createRefToElmWithValue(nestedType),
    },
    nestedList: { refType: createRefToElmWithValue(new ListType(nestedType)) },
    nestedMap: { refType: createRefToElmWithValue(new MapType(BuiltinTypes.STRING)) },
  },
})

describe('ducktype_field_finder', () => {
  describe('findNestedField', () => {
    it('should return undefined when more than one field satisfies the requirements', async () => {
      const fieldDetails = await findNestedField(sampleType)
      expect(fieldDetails).toBeUndefined()
    })
    it('should return field type when the matching field is an object', async () => {
      const fieldDetails = await findNestedField(sampleType, ['str', 'nestedMap', 'nestedList'])
      expect(fieldDetails).toEqual({
        field: sampleType.fields.nested,
        type: nestedType,
      })
    })
    it('should return undefined when keepOriginal is true', async () => {
      const fieldDetails = await findNestedField(sampleType, ['str', 'nestedMap', 'nestedList'], true)
      expect(fieldDetails).toBeUndefined()
    })
    it('should return inner type when the matching field is a list', async () => {
      const fieldDetails = await findNestedField(sampleType, ['str', 'nestedMap', 'nested'])
      expect(fieldDetails).toEqual({
        field: sampleType.fields.nestedList,
        type: nestedType,
      })
    })
    it('should return undefined when the only relevant field is a primitive type', async () => {
      const fieldDetails = await findNestedField(sampleType, ['nested', 'nestedMap', 'nestedList'])
      expect(fieldDetails).toBeUndefined()
    })
    it('should return undefined when the only relevant field is a map type', async () => {
      // this test is here to verify this case is handled gracefully.
      // if this becomes a real scenario, it should be changed according to the chosen structure.
      const fieldDetails = await findNestedField(sampleType, ['str', 'nested', 'nestedList'])
      expect(fieldDetails).toBeUndefined()
    })
    it('should return undefined when the object is empty', async () => {
      const type = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'bla'), fields: {} })
      const fieldDetails = await findNestedField(type)
      expect(fieldDetails).toBeUndefined()
    })
  })

  describe('returnFullEntry', () => {
    it('should return always return undefined', async () => {
      expect(await returnFullEntry(sampleType)).toBeUndefined()
      expect(await returnFullEntry(sampleType, ['str', 'nested'])).toBeUndefined()
      expect(await returnFullEntry(sampleType, ['str', 'nested', 'nestedMap'])).toBeUndefined()
      expect(await returnFullEntry(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'bla'),
        fields: {},
      }))).toBeUndefined()
    })
  })
})
