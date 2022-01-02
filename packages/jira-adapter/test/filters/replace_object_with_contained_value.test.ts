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

import {
  BuiltinTypes,
  createRefToElmWithValue,
  ElemID,
  InstanceElement,
  ListType,
  MapType,
  ObjectType,
} from '@salto-io/adapter-api'
import { JIRA } from '../../src/constants'
// eslint-disable-next-line import/no-named-as-default
import replaceObjectWithContainedValue, { ReplaceObjectWithContainedValueConfig } from '../../src/filters/replace_object_with_contained_value'
import { getDefaultAdapterConfig, mockClient } from '../utils'

describe('replaceObjectWithContainedValue', () => {
  let instanceType: ObjectType
  let instance: InstanceElement
  let containedObjectType: ObjectType
  let types: Record<string, ObjectType>

  const PRIMITIVE_FIELD_VALUE = 'primitiveField'
  const CONTAINED_OBJECT_VALUE = { id: 'containedObjectId' }
  beforeAll(async () => {
    containedObjectType = new ObjectType({
      elemID: new ElemID(JIRA, 'ContainedObject'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
      },
    })
    types = {
      FirstLevelPrimitive: new ObjectType({
        elemID: new ElemID(JIRA, 'FirstLevelPrimitive'),
        fields: {
          id: { refType: BuiltinTypes.STRING },
        },
      }),
      FirstLevelObject: new ObjectType({
        elemID: new ElemID(JIRA, 'FirstLevelObject'),
        fields: {
          containedObject: { refType: containedObjectType },
        },
      }),
      NestedPrimitive: new ObjectType({
        elemID: new ElemID(JIRA, 'NestedPrimitiveObject'),
        fields: {
          nested: {
            refType: new ObjectType({
              elemID: new ElemID(JIRA, 'NestedObject'),
              fields: {
                id: { refType: BuiltinTypes.STRING },
              },
            }),
          },
        },
      }),
      ListItem: new ObjectType({
        elemID: new ElemID(JIRA, 'ListItem'),
        fields: {
          id: { refType: BuiltinTypes.STRING },
        },
      }),
      MapItem: new ObjectType({
        elemID: new ElemID(JIRA, 'MapItem'),
        fields: {
          id: { refType: BuiltinTypes.STRING },
        },
      }),
      ObjectWithListOfListsField: new ObjectType({
        elemID: new ElemID(JIRA, 'ObjectWithListOfListsField'),
        fields: {
          lists: {
            refType: new ListType(new ListType(BuiltinTypes.STRING)),
          },
        },
      }),
      NoContainedValueAtPath: new ObjectType({
        elemID: new ElemID(JIRA, 'NoContainedValueAtPath'),
        fields: {
          id: { refType: BuiltinTypes.STRING },
        },
      }),
    }

    const configByTypeName: Record<string, ReplaceObjectWithContainedValueConfig> = {
      FirstLevelPrimitive: {
        containedValuePath: 'id',
        containedValueType: 'string',
      },
      FirstLevelObject: {
        containedValuePath: 'containedObject',
        containedValueType: 'ContainedObject',
      },
      NestedPrimitiveObject: {
        containedValuePath: 'nested.id',
        containedValueType: 'string',
      },
      ListItem: {
        containedValuePath: 'id',
        containedValueType: 'string',
      },
      MapItem: {
        containedValuePath: 'id',
        containedValueType: 'string',
      },
      ObjectWithListOfListsField: {
        containedValuePath: 'lists',
        containedValueType: 'string',
        containerFactory: (innerType => new ListType(new ListType(innerType))),
      },
      NoContainedValueAtPath: {
        containedValuePath: 'name',
        containedValueType: 'string',
      },
    }

    instanceType = new ObjectType({
      elemID: new ElemID(JIRA, 'TestType'),
      fields: {
        firstLevelPrimitive: { refType: types.FirstLevelPrimitive },
        firstLevelObject: { refType: types.FirstLevelObject },
        nestedPrimitive: { refType: types.NestedPrimitive },
        listField: { refType: new ListType(types.ListItem) },
        mapField: { refType: new MapType(types.MapItem) },
        objectWithListOfListsField: { refType: types.ObjectWithListOfListsField },
        noContainedValueAtPathListField: { refType: new ListType(types.NoContainedValueAtPath) },
      },
    })
    instance = new InstanceElement(
      'testInstance',
      instanceType,
      {
        firstLevelPrimitive: {
          id: PRIMITIVE_FIELD_VALUE,
        },
        firstLevelObject: {
          containedObject: CONTAINED_OBJECT_VALUE,
        },
        nestedPrimitive: {
          nested: {
            id: PRIMITIVE_FIELD_VALUE,
          },
        },
        listField: [
          { id: '1' },
          { id: '2' },
          { id: '3' },
        ],
        mapField: {
          first: { id: '1' },
          second: { id: '2' },
          third: { id: '3' },
        },
        objectWithListOfListsField: {
          lists: [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
          ],
        },
        noContainedValueAtPathListField: [
          { id: '1' },
          { id: '2' },
        ],
      },
    )
    configByTypeName.toString()
    instance.value.toString()
    const { client, paginator } = mockClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = replaceObjectWithContainedValue({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    })
    await filter
      .onFetch([instance, containedObjectType, ...Object.values(types)], configByTypeName)
  })

  it('should extract first level primitive value', () => {
    expect(instance.value.firstLevelPrimitive).toEqual(PRIMITIVE_FIELD_VALUE)
  })
  it('should extract first level object value', () => {
    expect(instance.value.firstLevelObject).toEqual(CONTAINED_OBJECT_VALUE)
  })
  it('should extract nested primitive value', () => {
    expect(instance.value.nestedPrimitive).toEqual(PRIMITIVE_FIELD_VALUE)
  })
  it('should extract values from list of objects', () => {
    expect(instance.value.listField).toEqual(['1', '2', '3'])
  })

  it('should extract map values', () => {
    expect(instance.value.mapField).toEqual({
      first: '1',
      second: '2',
      third: '3',
    })
  })
  it('should extract lists field from object', () => {
    expect(instance.value.objectWithListOfListsField).toEqual([
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
    ])
  })
  it('should override field types', () => {
    expect(instanceType.fields.firstLevelPrimitive.refType)
      .toEqual(createRefToElmWithValue(BuiltinTypes.STRING))
    expect(instanceType.fields.firstLevelObject.refType)
      .toEqual(createRefToElmWithValue(containedObjectType))
    expect(instanceType.fields.nestedPrimitive.refType)
      .toEqual(createRefToElmWithValue(BuiltinTypes.STRING))
    expect(instanceType.fields.listField.refType)
      .toEqual(createRefToElmWithValue(new ListType(BuiltinTypes.STRING)))
    expect(instanceType.fields.mapField.refType)
      .toEqual(createRefToElmWithValue(new MapType(BuiltinTypes.STRING)))
  })

  it('should override container field types', () => {
    expect(instanceType.fields.objectWithListOfListsField.refType)
      .toEqual(createRefToElmWithValue(new ListType(new ListType(BuiltinTypes.STRING))))
  })
  describe('when contained value does not exist at given path', () => {
    it('should not modify value', () => {
      expect(instance.value.noContainedValueAtPathListField).toEqual([
        { id: '1' },
        { id: '2' },
      ])
    })
    it('should not modify type', () => {
      expect(instanceType.fields.noContainedValueAtPathListField.refType)
        .toEqual(createRefToElmWithValue(new ListType(types.NoContainedValueAtPath)))
    })
  })
})
