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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FieldDefinition, BuiltinTypes, ObjectType, ElemID } from '@salto-io/adapter-api'
import { SUBTYPES_PATH, TYPES_PATH } from '../../src/elements/constants'
import { filterTypes, hideFields } from '../../src/elements/type_elements'

describe('type_elements', () => {
  describe('hideFields', () => {
    let myCustomType: ObjectType
    let fields: Record<string, FieldDefinition>

    beforeEach(() => {
      myCustomType = new ObjectType({
        elemID: new ElemID('adapter', 'myCustomType'),
        fields: {
          str: { refType: BuiltinTypes.STRING },
          num: { refType: BuiltinTypes.NUMBER },
        },
      })
      fields = {
        str: { refType: BuiltinTypes.STRING },
        num: { refType: BuiltinTypes.NUMBER },
        custom: { refType: myCustomType },
      }
    })
    it('should hide values for fields matching the specification', () => {
      hideFields([
        { fieldName: 'str', fieldType: 'string' },
      ], myCustomType.fields, 'bla')
      // eslint-disable-next-line no-underscore-dangle
      expect(myCustomType.fields.str.annotations._hidden_value).toBeTruthy()
      expect(myCustomType.fields.num.annotations).toEqual({})

      hideFields([
        { fieldName: 'num' },
        { fieldName: 'custom', fieldType: 'myCustomType' },
      ], fields, 'bla')
      // eslint-disable-next-line no-underscore-dangle
      expect(fields.num.annotations?._hidden_value).toBeTruthy()
      // eslint-disable-next-line no-underscore-dangle
      expect(fields.custom.annotations?._hidden_value).toBeTruthy()
      expect(fields.str.annotations).toBeUndefined()
    })
    it('should not hide values for fields that do not have the right type', () => {
      hideFields([
        { fieldName: 'str', fieldType: 'something' },
      ], myCustomType.fields, 'bla')
      expect(myCustomType.fields.str.annotations).toEqual({})
      expect(myCustomType.fields.num.annotations).toEqual({})

      hideFields([
        { fieldName: 'num', fieldType: 'string' },
        { fieldName: 'custom', fieldType: 'number' },
      ], fields, 'bla')
      expect(fields.str.annotations).toBeUndefined()
      expect(fields.num.annotations).toBeUndefined()
      expect(fields.custom.annotations).toBeUndefined()
    })
    it('should ignore fields that are not found', () => {
      hideFields([
        { fieldName: 'missing' },
      ], myCustomType.fields, 'bla')
      expect(Object.keys(myCustomType.fields)).toHaveLength(2)
      expect(myCustomType.fields.str.annotations).toEqual({})
      expect(myCustomType.fields.num.annotations).toEqual({})

      hideFields([
        { fieldName: 'missing' },
      ], fields, 'bla')
      expect(Object.keys(fields)).toHaveLength(3)
      expect(fields.str.annotations).toBeUndefined()
      expect(fields.num.annotations).toBeUndefined()
      expect(fields.custom.annotations).toBeUndefined()
    })
  })

  describe('filterTypes', () => {
    it('should filter the right types', async () => {
      const typeA = new ObjectType({ elemID: new ElemID('adapterName', 'A') })
      const typeB = new ObjectType({ elemID: new ElemID('adapterName', 'B'), path: ['adapter', 'somePath'] })
      const typeC = new ObjectType({ elemID: new ElemID('adapterName', 'C'),
        fields: {
          a: { refType: typeA },
          b: { refType: typeB },
        } })
      const typeD = new ObjectType({ elemID: new ElemID('adapterName', 'D') })
      const filteredTypes = await filterTypes('adapterName', [typeA, typeC, typeD], ['C', 'E'])

      expect(filteredTypes[0].elemID.getFullNameParts()).toEqual(['adapterName', 'C'])
      expect(filteredTypes[0].path).toEqual(['adapterName', TYPES_PATH, 'C'])
      expect(filteredTypes[1].elemID.getFullNameParts()).toEqual(['adapterName', 'A'])
      expect(filteredTypes[1].path).toEqual(['adapterName', TYPES_PATH, SUBTYPES_PATH, 'A'])
      expect(filteredTypes[2].elemID.getFullNameParts()).toEqual(['adapterName', 'B'])
      expect(filteredTypes[2].path).toEqual(['adapter', 'somePath'])
    })
  })
})
