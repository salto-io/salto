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
import { ObjectType, ElemID, BuiltinTypes, MapType, ListType } from '@salto-io/adapter-api'
import { findDataField, returnFullEntry } from '../../src/elements_deprecated/field_finder'

const ADAPTER_NAME = 'myAdapter'

const nestedType = new ObjectType({
  elemID: new ElemID(ADAPTER_NAME, 'nested'),
  fields: {
    str: { refType: BuiltinTypes.STRING },
    list: { refType: new ListType(BuiltinTypes.NUMBER) },
  },
})

const sampleType = new ObjectType({
  elemID: new ElemID(ADAPTER_NAME, 'bla'),
  fields: {
    str: { refType: BuiltinTypes.STRING },
    nested: {
      refType: nestedType,
    },
    nestedList: { refType: new ListType(nestedType) },
    nestedMap: { refType: new MapType(BuiltinTypes.STRING) },
  },
})

describe('ducktype_field_finder', () => {
  describe('findDataField', () => {
    it('should return undefined when more than one field satisfies the requirements', async () => {
      const fieldDetails = await findDataField(sampleType)
      expect(fieldDetails).toBeUndefined()
    })
    it('should return field type when the matching field is an object', async () => {
      const fieldDetails = await findDataField(sampleType, [
        { fieldName: 'str', fieldType: 'string' },
        { fieldName: 'nestedMap' },
        { fieldName: 'nestedList' },
      ])
      expect(fieldDetails).toEqual({
        field: sampleType.fields.nested,
        type: nestedType,
      })
    })
    it('should return undefined when the specified data field is the entire object (".")', async () => {
      const fieldDetails = await findDataField(
        sampleType,
        [{ fieldName: 'str', fieldType: 'string' }, { fieldName: 'nestedMap' }, { fieldName: 'nestedList' }],
        '.',
      )
      expect(fieldDetails).toBeUndefined()
    })
    it('should return undefined when the specified data field is not an object type', async () => {
      const fieldDetails = await findDataField(sampleType, undefined, 'str')
      expect(fieldDetails).toBeUndefined()
    })
    it('should return inner type when the matching field is a list', async () => {
      const fieldDetails = await findDataField(sampleType, [
        { fieldName: 'str', fieldType: 'string' },
        { fieldName: 'nestedMap' },
        { fieldName: 'nested' },
      ])
      expect(fieldDetails).toEqual({
        field: sampleType.fields.nestedList,
        type: nestedType,
      })
    })
    it('should return undefined when the only relevant field is a primitive type', async () => {
      const fieldDetails = await findDataField(sampleType, [
        { fieldName: 'nested' },
        { fieldName: 'nestedMap' },
        { fieldName: 'nestedList' },
      ])
      expect(fieldDetails).toBeUndefined()
    })
    it('should return undefined when the only relevant field is a map type', async () => {
      // this test is here to verify this case is handled gracefully.
      // if this becomes a real scenario, it should be changed according to the chosen structure.
      const fieldDetails = await findDataField(sampleType, [
        { fieldName: 'str', fieldType: 'string' },
        { fieldName: 'nested' },
        { fieldName: 'nestedList' },
      ])
      expect(fieldDetails).toBeUndefined()
    })
    it('should return undefined when the object is empty', async () => {
      const type = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'bla'), fields: {} })
      const fieldDetails = await findDataField(type)
      expect(fieldDetails).toBeUndefined()
    })
  })

  describe('returnFullEntry', () => {
    it('should return always return undefined', async () => {
      expect(await returnFullEntry(sampleType)).toBeUndefined()
      expect(
        await returnFullEntry(sampleType, [{ fieldName: 'str', fieldType: 'string' }, { fieldName: 'nested' }]),
      ).toBeUndefined()
      expect(
        await returnFullEntry(sampleType, [
          { fieldName: 'str', fieldType: 'string' },
          { fieldName: 'nested' },
          { fieldName: 'nestedMap' },
        ]),
      ).toBeUndefined()
      expect(
        await returnFullEntry(
          new ObjectType({
            elemID: new ElemID(ADAPTER_NAME, 'bla'),
            fields: {},
          }),
        ),
      ).toBeUndefined()
    })
  })
})
