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
import { ObjectType, Values, ElemID, BuiltinTypes, MapType } from '@salto-io/adapter-api'
// eslint-disable-next-line
import { generateType } from '../../../src/elements/ducktype/type_elements'
import { TYPES_PATH, SUBTYPES_PATH } from '../../../src/elements/constants'

/* eslint-disable @typescript-eslint/camelcase */
const ADAPTER_NAME = 'myAdapter'

describe('boostrap_type_elements', () => {
  describe('generateType', () => {
    it('should generate empty types when no entries are provided', () => {
      const entries: Values[] = []
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: false,
        isSubType: false,
      })
      expect(type.isEqual(new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'typeName'), fields: {} }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
      expect(type.path).toEqual([ADAPTER_NAME, TYPES_PATH, 'typeName'])
    })
    it('should generate types recursively with correct fields when hasDynamicFields=false', () => {
      const entries = [
        {
          id: 41619,
          api_collection_id: 11815,
          flow_id: 1381119,
          name: 'ab321',
          method: 'GET',
          url: 'https://some.url.com/a/bbb/user/{id}',
          legacy_url: null,
          base_path: '/a/bbb/user/{id}',
          path: 'user/{id}',
          active: false,
          legacy: false,
          created_at: '2020-12-21T16:08:03.762-08:00',
          updated_at: '2020-12-21T16:08:03.762-08:00',
        },
        {
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
        },
        {
          field_with_complex_type: {
            number: 222,
            nested_type: {
              val: 'agds',
              another_val: 7,
              abc: 'abc',
              unknown: null,
            },
          },
        },
      ]
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: false,
        isSubType: false,
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          id: { type: BuiltinTypes.NUMBER },
          api_collection_id: { type: BuiltinTypes.NUMBER },
          flow_id: { type: BuiltinTypes.NUMBER },
          name: { type: BuiltinTypes.STRING },
          method: { type: BuiltinTypes.STRING },
          url: { type: BuiltinTypes.STRING },
          legacy_url: { type: BuiltinTypes.UNKNOWN },
          base_path: { type: BuiltinTypes.STRING },
          path: { type: BuiltinTypes.STRING },
          active: { type: BuiltinTypes.BOOLEAN },
          legacy: { type: BuiltinTypes.BOOLEAN },
          created_at: { type: BuiltinTypes.STRING },
          updated_at: { type: BuiltinTypes.STRING },
          field_with_complex_type: { type: nestedTypes[0] },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(2)
      expect(nestedTypes[0].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__field_with_complex_type'),
        fields: {
          number: { type: BuiltinTypes.NUMBER },
          nested_type: { type: nestedTypes[1] },
        },
      }))).toBeTruthy()
      expect(nestedTypes[1].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__field_with_complex_type__nested_type'),
        fields: {
          val: { type: BuiltinTypes.STRING },
          another_val: { type: BuiltinTypes.UNKNOWN },
          abc: { type: BuiltinTypes.STRING },
          unknown: { type: BuiltinTypes.UNKNOWN },
        },
      }))).toBeTruthy()
    })
    it('should generate primitive types with correct fields when hasDynamicFields=true', () => {
      const entries = [
        {
          'a.b': 'some value abc',
          something: 'something else',
        },
      ]
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: true,
        isSubType: false,
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          value: { type: new MapType(BuiltinTypes.STRING) },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
    })
    it('should generate types recursively with correct fields when hasDynamicFields=true', () => {
      const entries = [
        {
          'a.b': {
            a: 'string',
            b: 123,
            complex: {
              str: 'str',
              num: 15478,
            },
          },
          something: {
            a: 'another string',
            c: true,
          },
        },
      ]
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: true,
        isSubType: false,
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          value: { type: new MapType(nestedTypes[0]) },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(2)
      expect(nestedTypes[0].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__value'),
        fields: {
          a: { type: BuiltinTypes.STRING },
          b: { type: BuiltinTypes.NUMBER },
          c: { type: BuiltinTypes.BOOLEAN },
          complex: { type: nestedTypes[1] },
        },
      }))).toBeTruthy()
      expect(nestedTypes[1].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__value__complex'),
        fields: {
          str: { type: BuiltinTypes.STRING },
          num: { type: BuiltinTypes.NUMBER },
        },
      }))).toBeTruthy()
    })
    it('should use unknown value when hasDynamicFields=true and values are inconsistent', () => {
      const entries = [
        {
          'a.b': 'some value abc',
          something: 'something else',
        },
        {
          'c.d': 123,
          something: 'something else',
        },
      ]
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: true,
        isSubType: false,
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          value: { type: new MapType(BuiltinTypes.UNKNOWN) },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
    })
    it('should apply naclcase when needed', () => {
      const entries: Values[] = []
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName.requiring_naclcase',
        entries,
        hasDynamicFields: false,
        isSubType: false,
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName_requiring_naclcase@vu'),
        fields: {},
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
      expect(type.path).toEqual([ADAPTER_NAME, TYPES_PATH, 'typeName_requiring_naclcase'])
    })
    it('should use subtypes path for subtypes', () => {
      const entries: Values[] = []
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'parent_type__subtypeName',
        entries,
        hasDynamicFields: false,
        isSubType: true,
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'parent_type__subtypeName'),
        fields: {},
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
      expect(type.path).toEqual([ADAPTER_NAME, TYPES_PATH, SUBTYPES_PATH, 'parent_type_', 'subtypeName'])
    })
  })
})
