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
import { ObjectType, Values, ElemID, BuiltinTypes, MapType, ListType } from '@salto-io/adapter-api'
// eslint-disable-next-line
import { generateType } from '../../../src/elements/ducktype'
import { TYPES_PATH, SUBTYPES_PATH } from '../../../src/elements'

/* eslint-disable camelcase */
const ADAPTER_NAME = 'myAdapter'

describe('ducktype_type_elements', () => {
  describe('generateType', () => {
    it('should generate empty types when no entries are provided', () => {
      const entries: Values[] = []
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: false,
        isSubType: false,
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'typeName'), fields: {} }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
      expect(type.path).toEqual([ADAPTER_NAME, TYPES_PATH, 'typeName'])
    })
    it('should override field types for types with fieldTypeOverrides', () => {
      const entries: Values[] = [{ name: 'test' }]
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: false,
        isSubType: false,
        transformationConfigByType: { typeName: { fieldTypeOverrides: [{ fieldName: 'name', fieldType: 'number' }] } },
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'typeName'), fields: { name: { refType: BuiltinTypes.NUMBER } } }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
      expect(type.path).toEqual([ADAPTER_NAME, TYPES_PATH, 'typeName'])
    })
    it('should override field types for types with nested fieldTypeOverrides', () => {
      const entries: Values[] = [{
        nested: {
          a: 'a',
          b: 'b',
        },
        name: 'test',
      }]
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: false,
        isSubType: false,
        transformationConfigByType: { typeName: { fieldTypeOverrides: [{ fieldName: 'name', fieldType: 'map<typeName__nested>' }] } },
        transformationDefaultConfig: { idFields: [] },
      })
      expect(nestedTypes).toHaveLength(1)
      expect(type.fields.name.refType.elemID.getFullName()).toEqual('Map<myAdapter.typeName__nested>')
      expect(type.path).toEqual([ADAPTER_NAME, TYPES_PATH, 'typeName'])
    })
    it('should override field types for types with fieldTypeOverrides even if there are no entries', () => {
      const entries: Values[] = []
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: false,
        isSubType: false,
        transformationConfigByType: { typeName: { fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }] } },
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'typeName'), fields: { id: { refType: BuiltinTypes.NUMBER } } }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
      expect(type.path).toEqual([ADAPTER_NAME, TYPES_PATH, 'typeName'])
    })
    it('should generate types recursively with correct fields when hasDynamicFields=false', () => {
      const entries = [
        {
          id: 41619,
          api_collection_id: 11815,
          flow_id: 1381119,
          flow_ids: [1381119, 1382229],
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
          flow_ids: [890, 980],
          name: 'some other name',
          field_with_complex_type: {
            number: 53,
            nested_type: {
              val: 'agds',
              another_val: 'dgadgasg',
            },
          },
          field_with_complex_list_type: [{
            number: 53,
          }],
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
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          api_collection_id: { refType: BuiltinTypes.NUMBER },
          flow_id: { refType: BuiltinTypes.NUMBER },
          flow_ids: { refType: new ListType(BuiltinTypes.NUMBER) },
          name: { refType: BuiltinTypes.STRING },
          method: { refType: BuiltinTypes.STRING },
          url: { refType: BuiltinTypes.STRING },
          legacy_url: { refType: BuiltinTypes.UNKNOWN },
          base_path: { refType: BuiltinTypes.STRING },
          path: { refType: BuiltinTypes.STRING },
          active: { refType: BuiltinTypes.BOOLEAN },
          legacy: { refType: BuiltinTypes.BOOLEAN },
          created_at: { refType: BuiltinTypes.STRING },
          updated_at: { refType: BuiltinTypes.STRING },
          field_with_complex_type: { refType: nestedTypes[0] },
          field_with_complex_list_type: {
            refType: new ListType(nestedTypes[2]),
          },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(3)
      expect(nestedTypes[0].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__field_with_complex_type'),
        fields: {
          number: { refType: BuiltinTypes.NUMBER },
          nested_type: { refType: nestedTypes[1] },
        },
      }))).toBeTruthy()
      expect(nestedTypes[1].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__field_with_complex_type__nested_type'),
        fields: {
          val: { refType: BuiltinTypes.STRING },
          another_val: { refType: BuiltinTypes.UNKNOWN },
          abc: { refType: BuiltinTypes.STRING },
          unknown: { refType: BuiltinTypes.UNKNOWN },
        },
      }))).toBeTruthy()
      expect(nestedTypes[2].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__field_with_complex_list_type'),
        fields: {
          number: { refType: BuiltinTypes.NUMBER },
        },
      }))).toBeTruthy()
    })
    it('should generate types with correct names when sourceTypeName is used', () => {
      const entries = [
        {
          id: 41619,
          api_collection_id: 11815,
          flow_id: 1381119,
          flow_ids: [1381119, 1382229],
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
          flow_ids: [890, 980],
          name: 'some other name',
          field_with_complex_type: {
            number: 53,
            nested_type: {
              val: 'agds',
              another_val: 'dgadgasg',
            },
          },
          field_with_complex_list_type: [{
            number: 53,
          }],
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
        transformationConfigByType: {
          renamedComplex: {
            sourceTypeName: 'renamedTypeName__field_with_complex_type',
          },
          renamedTypeName: {
            sourceTypeName: 'typeName',
          },
        },
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'renamedTypeName'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          api_collection_id: { refType: BuiltinTypes.NUMBER },
          flow_id: { refType: BuiltinTypes.NUMBER },
          flow_ids: { refType: new ListType(BuiltinTypes.NUMBER) },
          name: { refType: BuiltinTypes.STRING },
          method: { refType: BuiltinTypes.STRING },
          url: { refType: BuiltinTypes.STRING },
          legacy_url: { refType: BuiltinTypes.UNKNOWN },
          base_path: { refType: BuiltinTypes.STRING },
          path: { refType: BuiltinTypes.STRING },
          active: { refType: BuiltinTypes.BOOLEAN },
          legacy: { refType: BuiltinTypes.BOOLEAN },
          created_at: { refType: BuiltinTypes.STRING },
          updated_at: { refType: BuiltinTypes.STRING },
          field_with_complex_type: { refType: nestedTypes[0] },
          field_with_complex_list_type: {
            refType: new ListType(nestedTypes[2]),
          },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(3)
      expect(nestedTypes[0].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'renamedComplex'),
        fields: {
          number: { refType: BuiltinTypes.NUMBER },
          nested_type: { refType: nestedTypes[1] },
        },
      }))).toBeTruthy()
      expect(nestedTypes[1].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'renamedComplex__nested_type'),
        fields: {
          val: { refType: BuiltinTypes.STRING },
          another_val: { refType: BuiltinTypes.UNKNOWN },
          abc: { refType: BuiltinTypes.STRING },
          unknown: { refType: BuiltinTypes.UNKNOWN },
        },
      }))).toBeTruthy()
      expect(nestedTypes[2].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'renamedTypeName__field_with_complex_list_type'),
        fields: {
          number: { refType: BuiltinTypes.NUMBER },
        },
      }))).toBeTruthy()
    })
    it('should annotate fields marked as fieldsToHide with _hidden_value', () => {
      const entries = [
        {
          id: 41619,
          api_collection_id: 11815,
          flow_id: 1381119,
          flow_ids: [1381119, 1382229],
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
          flow_ids: [890, 980],
          name: 'some other name',
          field_with_complex_type: {
            number: 53,
            nested_type: {
              val: 'agds',
              another_val: 'dgadgasg',
            },
          },
          field_with_complex_list_type: [{
            number: 53,
          }],
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
        transformationConfigByType: {
          typeName: {
            fieldsToHide: [
              { fieldName: 'flow_id', fieldType: 'number' },
            ],
          },
          typeName__field_with_complex_type: {
            fieldsToHide: [
              { fieldName: 'number' },
            ],
          },
        },
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          api_collection_id: { refType: BuiltinTypes.NUMBER },
          flow_id: {
            refType: BuiltinTypes.NUMBER,
            annotations: { _hidden_value: true },
          },
          flow_ids: { refType: new ListType(BuiltinTypes.NUMBER) },
          name: { refType: BuiltinTypes.STRING },
          method: { refType: BuiltinTypes.STRING },
          url: { refType: BuiltinTypes.STRING },
          legacy_url: { refType: BuiltinTypes.UNKNOWN },
          base_path: { refType: BuiltinTypes.STRING },
          path: { refType: BuiltinTypes.STRING },
          active: { refType: BuiltinTypes.BOOLEAN },
          legacy: { refType: BuiltinTypes.BOOLEAN },
          created_at: { refType: BuiltinTypes.STRING },
          updated_at: { refType: BuiltinTypes.STRING },
          field_with_complex_type: { refType: nestedTypes[0] },
          field_with_complex_list_type: {
            refType: new ListType(nestedTypes[2]),
          },
        },
      }))).toBeTruthy()
      expect(nestedTypes[0].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__field_with_complex_type'),
        fields: {
          number: {
            refType: BuiltinTypes.NUMBER,
            annotations: { _hidden_value: true },
          },
          nested_type: { refType: nestedTypes[1] },
        },
      }))).toBeTruthy()
    })
    it('should ignore nulls when determining types for fields', () => {
      const entries = [
        {
          id: 41619,
          name: 'ab321',
          active: false,
          only_exists_once: null,
        },
        {
          id: null,
          name: undefined,
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
            number: null,
            nested_type: {
              val: null,
              another_val: 7,
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
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          name: { refType: BuiltinTypes.STRING },
          active: { refType: BuiltinTypes.BOOLEAN },
          only_exists_once: { refType: BuiltinTypes.UNKNOWN },
          field_with_complex_type: { refType: nestedTypes[0] },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(2)
      expect(nestedTypes[0].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__field_with_complex_type'),
        fields: {
          number: { refType: BuiltinTypes.NUMBER },
          nested_type: { refType: nestedTypes[1] },
        },
      }))).toBeTruthy()
      expect(nestedTypes[1].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__field_with_complex_type__nested_type'),
        fields: {
          val: { refType: BuiltinTypes.STRING },
          another_val: { refType: BuiltinTypes.UNKNOWN },
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
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          value: { refType: new MapType(BuiltinTypes.STRING) },
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
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          value: { refType: new MapType(nestedTypes[0]) },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(2)
      expect(nestedTypes[0].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__value'),
        fields: {
          a: { refType: BuiltinTypes.STRING },
          b: { refType: BuiltinTypes.NUMBER },
          c: { refType: BuiltinTypes.BOOLEAN },
          complex: { refType: nestedTypes[1] },
        },
      }))).toBeTruthy()
      expect(nestedTypes[1].isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName__value__complex'),
        fields: {
          str: { refType: BuiltinTypes.STRING },
          num: { refType: BuiltinTypes.NUMBER },
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
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          value: { refType: new MapType(BuiltinTypes.UNKNOWN) },
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
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
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
        transformationConfigByType: {},
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'parent_type__subtypeName'),
        fields: {},
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
      expect(type.path).toEqual([ADAPTER_NAME, TYPES_PATH, SUBTYPES_PATH, 'parent_type', 'subtypeName'])
    })
    it('should mark singleton types as isSettings=true', () => {
      const entries = [
        {
          id: 41619,
          api_collection_id: 11815,
          flow_id: 1381119,
          flow_ids: [1381119, 1382229],
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
      ]
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'typeName',
        entries,
        hasDynamicFields: false,
        isSubType: false,
        transformationConfigByType: {
          typeName: {
            isSingleton: true,
          },
        },
        transformationDefaultConfig: { idFields: [] },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'typeName'),
        fields: {
          id: { refType: BuiltinTypes.NUMBER },
          api_collection_id: { refType: BuiltinTypes.NUMBER },
          flow_id: { refType: BuiltinTypes.NUMBER },
          flow_ids: { refType: new ListType(BuiltinTypes.NUMBER) },
          name: { refType: BuiltinTypes.STRING },
          method: { refType: BuiltinTypes.STRING },
          url: { refType: BuiltinTypes.STRING },
          legacy_url: { refType: BuiltinTypes.UNKNOWN },
          base_path: { refType: BuiltinTypes.STRING },
          path: { refType: BuiltinTypes.STRING },
          active: { refType: BuiltinTypes.BOOLEAN },
          legacy: { refType: BuiltinTypes.BOOLEAN },
          created_at: { refType: BuiltinTypes.STRING },
          updated_at: { refType: BuiltinTypes.STRING },
        },
        isSettings: true,
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
    })
    it('should create an empty type with the service id field', () => {
      const { type, nestedTypes } = generateType({
        adapterName: ADAPTER_NAME,
        name: 'target',
        entries: [],
        hasDynamicFields: false,
        isSubType: false,
        transformationConfigByType: {
          target: {
            fieldTypeOverrides: [
              { fieldName: 'id', fieldType: 'number' },
            ],
          },
        },
        transformationDefaultConfig: { idFields: [], serviceIdField: 'id' },
      })
      expect(type.isEqual(new ObjectType({
        elemID: new ElemID(ADAPTER_NAME, 'target'),
        fields: {
          id: { refType: BuiltinTypes.SERVICE_ID_NUMBER },
        },
      }))).toBeTruthy()
      expect(nestedTypes).toHaveLength(0)
    })
  })
})
