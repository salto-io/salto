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
import _ from 'lodash'
import { ElemID, InstanceElement, ObjectType, ReferenceExpression, Element, BuiltinTypes, isInstanceElement, ListType, createRefToElmWithValue, Field } from '@salto-io/adapter-api'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { addReferences, generateLookupFunc } from '../../src/references/field_references'
import { FieldReferenceDefinition } from '../../src/references/reference_mapping'
import { ContextValueMapperFunc, ContextFunc, neighborContextGetter } from '../../src/references'

const ADAPTER_NAME = 'myAdapter'

const neighborContextFunc = (args: {
  contextFieldName: string
  levelsUp?: number
  contextValueMapper?: ContextValueMapperFunc
}): ContextFunc => neighborContextGetter({
  ...args,
  getLookUpName: async ({ ref }) => ref?.elemID.name,
})

describe('Field references', () => {
  const apiClientType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'api_client'),
    fields: {
      id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    },
  })
  const apiCollectionType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'api_collection'),
    fields: {
      id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      // eslint-disable-next-line camelcase
      api_client_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    },
  })
  const folderType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'folder'),
    fields: {
      id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      // eslint-disable-next-line camelcase
      parent_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    },
  })
  const apiAccessProfileType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'api_access_profile'),
    fields: {
      // eslint-disable-next-line camelcase
      api_client_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
      // eslint-disable-next-line camelcase
      api_collection_ids: { refType: createRefToElmWithValue(new ListType(BuiltinTypes.NUMBER)) },
    },
  })
  const apiEndpointType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'api_endpoint'),
    fields: {
      // eslint-disable-next-line camelcase
      flow_id: { refType: createRefToElmWithValue(BuiltinTypes.NUMBER) },
    },
  })

  const productType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'product'),
    fields: {
      name: { refType: BuiltinTypes.STRING },
    },
  })
  const brandType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'brand'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
    },
  })
  const groupType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'group'),
    fields: {
      id: { refType: BuiltinTypes.NUMBER },
      basedOnRef: { refType: BuiltinTypes.STRING },
      ref: { refType: BuiltinTypes.STRING },
    },
  })
  const someTypeWithValue = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'typeWithValue'),
    fields: {
      // eslint-disable-next-line camelcase
      value: { refType: BuiltinTypes.UNKNOWN },
      bla: { refType: BuiltinTypes.STRING },
    },
  })
  const someTypeWithNestedValuesAndSubject = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'typeWithValueAndSubject'),
    fields: {
      // eslint-disable-next-line camelcase
      valueList: { refType: new ListType(someTypeWithValue) },
      subject: { refType: BuiltinTypes.STRING },
    },
  })
  const someTypeWithNestedValueList = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'typeWithValueList'),
    fields: {
      // eslint-disable-next-line camelcase
      list: { refType: new ListType(someTypeWithValue) },
      type: { refType: BuiltinTypes.STRING },
    },
  })
  const someTypeWithNestedListOfValuesAndValue = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'typeWithNestedValues'),
    fields: {
      value: { refType: BuiltinTypes.STRING },
      values: { refType: new ListType(someTypeWithNestedValueList) },
    },
  })
  const type1 = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'type1'),
    fields: {
      nestedValues: { refType: new ListType(someTypeWithNestedListOfValuesAndValue) },
      subjectAndValues: { refType: new ListType(someTypeWithNestedValuesAndSubject) },
      product: { refType: BuiltinTypes.STRING },
      fail: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
  })

  const generateElements = (
  ): Element[] => ([
    apiClientType,
    new InstanceElement('cli123', apiClientType, { id: 123 }),
    apiCollectionType,
    new InstanceElement('collection123', apiCollectionType, { id: 123 }),
    // eslint-disable-next-line camelcase
    new InstanceElement('collection456', apiCollectionType, { id: 456, api_client_id: 123 }),
    folderType,
    // eslint-disable-next-line camelcase
    new InstanceElement('folder11', folderType, { id: 11, parent_id: 'invalid' }),
    // eslint-disable-next-line camelcase
    new InstanceElement('folder222', folderType, { id: 222, parent_id: 11 }),
    apiAccessProfileType,
    // eslint-disable-next-line camelcase
    new InstanceElement('prof1', apiAccessProfileType, { api_client_id: 123, api_collection_ids: [456] }),
    apiEndpointType,
    // eslint-disable-next-line camelcase
    new InstanceElement('ep1', apiEndpointType, { flow_id: 123 }),
    productType,
    brandType,
    groupType,
    someTypeWithValue,
    someTypeWithNestedValuesAndSubject,
    someTypeWithNestedValueList,
    someTypeWithNestedListOfValuesAndValue,
    type1,
    new InstanceElement('productABC', productType, { name: 'ABC' }),
    new InstanceElement('brand1', brandType, { id: 1001 }),
    new InstanceElement('brand2', brandType, { id: 1002 }),
    new InstanceElement('group3', groupType, { id: '2003' }),
    new InstanceElement('group4', groupType, { id: '2004', basedOnRef: '2003', ref: new ReferenceExpression(groupType.elemID) }),
    new InstanceElement('inst1', type1, {
      subjectAndValues: [
        {
          valueList: [{ value: '1001', bla: 'ignore' }],
          subject: 'brand_id',
        },
        {
          valueList: [{ value: 4007, bla: 'ignore' }],
          subject: 'unrelated',
        },
      ],
      nestedValues: [
        {
          value: 'brand_id',
          values: [
            { list: [{ value: 1001 }, { value: 123 }], type: 'ignore' },
            { list: [{ value: 123 }, { value: 1002 }], type: 'ignore' },
          ],
        },
        {
          value: 'group_id',
          values: [
            { list: [{ value: '2003' }], type: 'ignore' },
          ],
        },
      ],
      product: 'ABC',
      fail: 'fail',
      value: 'fail',
    }),
  ])

  describe('addReferences', () => {
    let elements: Element[]
    const fieldNameToTypeMappingDefs: FieldReferenceDefinition<'parentSubject' | 'parentValue' | 'neighborRef' | 'fail'>[] = [
      {
        src: { field: 'api_client_id', parentTypes: ['api_access_profile'] },
        serializationStrategy: 'id',
        target: { type: 'api_client' },
      },
      {
        src: { field: 'api_collection_ids', parentTypes: ['api_access_profile'] },
        serializationStrategy: 'id',
        target: { type: 'api_collection' },
      },
      {
        src: { field: 'api_collection_id', parentTypes: ['api_endpoint'] },
        serializationStrategy: 'id',
        target: { type: 'api_collection' },
      },
      {
        src: { field: 'flow_id', parentTypes: ['api_endpoint'] },
        serializationStrategy: 'id',
        target: { type: 'recipe' },
      },
      {
        src: { field: 'parent_id', parentTypes: ['folder'] },
        serializationStrategy: 'id',
        target: { type: 'folder' },
      },
      {
        src: { field: 'value' },
        serializationStrategy: 'id',
        target: { typeContext: 'parentSubject' },
      },
      {
        src: { field: 'value' },
        serializationStrategy: 'id',
        target: { typeContext: 'parentValue' },
      },
      {
        src: { field: 'basedOnRef' },
        serializationStrategy: 'id',
        target: { typeContext: 'neighborRef' },
      },
      {
        src: { field: 'product' },
        serializationStrategy: 'name',
        target: { type: 'product' },
      },
    ]

    beforeAll(async () => {
      elements = generateElements()
      await addReferences({
        elements,
        defs: fieldNameToTypeMappingDefs,
        fieldsToGroupBy: ['id', 'name'],
        contextStrategyLookup: {
          parentSubject: neighborContextFunc({ contextFieldName: 'subject', levelsUp: 1, contextValueMapper: val => val.replace('_id', '') }),
          parentValue: neighborContextFunc({ contextFieldName: 'value', levelsUp: 2, contextValueMapper: val => val.replace('_id', '') }),
          neighborRef: neighborContextFunc({ contextFieldName: 'ref' }),
          fail: neighborContextFunc({ contextFieldName: 'product', contextValueMapper: () => { throw new Error('fail') } }),
        },
      })
    })

    it('should resolve field values when referenced element exists', () => {
      const prof = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'api_access_profile'
      )[0] as InstanceElement
      expect(prof.value.api_client_id).toBeInstanceOf(ReferenceExpression)
      expect(prof.value.api_client_id?.elemID.getFullName()).toEqual('myAdapter.api_client.instance.cli123')
      expect(prof.value.api_collection_ids).toHaveLength(1)
      expect(prof.value.api_collection_ids[0]).toBeInstanceOf(ReferenceExpression)
      expect(prof.value.api_collection_ids[0].elemID.getFullName()).toEqual('myAdapter.api_collection.instance.collection456')

      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder'
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[1].value.parent_id).toBeInstanceOf(ReferenceExpression)
      expect(folders[1].value.parent_id.elemID.getFullName()).toEqual('myAdapter.folder.instance.folder11')

      const inst = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'inst1'
      )[0] as InstanceElement
      expect(inst.value.nestedValues[0].values[0].list[0].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[0].values[0].list[0].value.elemID.getFullName()).toEqual('myAdapter.brand.instance.brand1')
      expect(inst.value.nestedValues[0].values[1].list[1].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[0].values[1].list[1].value.elemID.getFullName()).toEqual('myAdapter.brand.instance.brand2')
      expect(inst.value.nestedValues[1].values[0].list[0].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[1].values[0].list[0].value.elemID.getFullName()).toEqual('myAdapter.group.instance.group3')
      expect(inst.value.product).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.product.elemID.getFullName()).toEqual('myAdapter.product.instance.productABC')
    })
    it('should resolve field values when context field is a reference', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'group4'
      )[0] as InstanceElement
      expect(inst.value.basedOnRef).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.basedOnRef.elemID.getFullName()).toEqual('myAdapter.group.instance.group3')
    })
    it('should not resolve fields in unexpected types even if field name matches', () => {
      const collections = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'api_collection'
      ) as InstanceElement[]
      expect(collections).toHaveLength(2)
      expect(collections[1].value.api_client_id).not.toBeInstanceOf(ReferenceExpression)
      expect(collections[1].value.api_client_id).toEqual(123)
    })
    it('should not resolve fields if values are not identical, even if the only difference is string vs number', () => {
      const inst = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'inst1'
      )[0] as InstanceElement
      expect(
        inst.value.subjectAndValues[0].valueList[0].value
      ).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.subjectAndValues[0].valueList[0].value).toEqual('1001')
    })

    it('should not resolve if referenced element does not exist', () => {
      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder'
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[0].value.parent_id).not.toBeInstanceOf(ReferenceExpression)
      expect(folders[0].value.parent_id).toEqual('invalid')
    })
    it('should resolve fields if isEqualValue() returns true for values', async () => {
      const clonedElements = generateElements()
      await addReferences({
        elements: clonedElements,
        defs: fieldNameToTypeMappingDefs,
        fieldsToGroupBy: ['id', 'name'],
        contextStrategyLookup: {
          parentSubject: neighborContextFunc({ contextFieldName: 'subject', levelsUp: 1, contextValueMapper: val => val.replace('_id', '') }),
          parentValue: neighborContextFunc({ contextFieldName: 'value', levelsUp: 2, contextValueMapper: val => val.replace('_id', '') }),
          neighborRef: neighborContextFunc({ contextFieldName: 'ref' }),
          fail: neighborContextFunc({ contextFieldName: 'fail', contextValueMapper: () => { throw new Error('fail') } }),
        },
        isEqualValue: (lhs, rhs) => _.toString(lhs) === _.toString(rhs),
      })

      const inst = clonedElements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'inst1'
      )[0] as InstanceElement
      expect(inst.value.subjectAndValues[0].valueList[0].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.subjectAndValues[0].valueList[0].value.elemID.getFullName()).toEqual('myAdapter.brand.instance.brand1')
    })
  })

  describe('generateLookupNameFunc', () => {
    let lookupNameFunc: GetLookupNameFunc
    const fieldNameToTypeMappingDefs: FieldReferenceDefinition<'parentSubject' | 'parentValue' | 'neighborRef' | 'fail'>[] = [
      {
        src: { field: 'api_client_id', parentTypes: ['api_access_profile'] },
        serializationStrategy: 'id',
        target: { type: 'api_client' },
      },
      {
        src: { field: 'api_collection_ids', parentTypes: ['api_access_profile'] },
        serializationStrategy: 'name',
        target: { type: 'api_collection' },
      },
      {
        src: { field: 'api_collection_ids', parentTypes: ['api_access_profile'] },
        serializationStrategy: 'id',
        target: { type: 'api_collection' },
      },
    ]

    beforeAll(async () => {
      lookupNameFunc = generateLookupFunc(fieldNameToTypeMappingDefs)
    })

    it('should resolve using id strategy when rule is matched', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(
          new ElemID('adapter', 'api_client', 'instance', 'instance'),
          new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'api_client') }), { id: 2, name: 'name' }),
        ),
        field: new Field(new ObjectType({ elemID: new ElemID('adapter', 'api_access_profile') }), 'api_client_id', BuiltinTypes.NUMBER),
        path: new ElemID('adapter', 'somePath'),
      })

      expect(res).toEqual(2)
    })

    it('should resolve using the first strategy when multiple strategies are matched', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(
          new ElemID('adapter', 'api_collection', 'instance', 'instance'),
          new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'api_collection') }), { id: 2, name: 'name' }),
        ),
        field: new Field(new ObjectType({ elemID: new ElemID('adapter', 'api_access_profile') }), 'api_collection_ids', BuiltinTypes.NUMBER),
        path: new ElemID('adapter', 'somePath'),
      })

      expect(res).toEqual('name')
    })

    it('should resolve using full value strategy when no rule is matched', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(
          new ElemID('adapter', 'someType', 'instance', 'instance'),
          new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'someType') }), { id: 2, name: 'name' }),
        ),
        field: new Field(new ObjectType({ elemID: new ElemID('adapter', 'someType') }), 'api_collection_ids', BuiltinTypes.NUMBER),
        path: new ElemID('adapter', 'somePath'),
      })

      expect(res).toEqual({ id: 2, name: 'name' })
    })

    it('should resolve using full value strategy when field is undefined', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(
          new ElemID('adapter', 'someType', 'instance', 'instance'),
          { id: 2, name: 'name' },
        ),
        path: new ElemID('adapter', 'somePath'),
      })

      expect(res).toEqual({ id: 2, name: 'name' })
    })
  })
  describe('failure modes', () => {
    let elements: Element[]
    const fieldNameToTypeMappingDefs: FieldReferenceDefinition<'parentSubject' | 'parentValue' | 'neighborRef' | 'fail'>[] = [
      {
        src: { field: 'fail' },
        serializationStrategy: 'id',
        target: { typeContext: 'fail' },
      },
      {
        src: { field: 'value' },
        serializationStrategy: 'id',
        target: { typeContext: 'fail' },
      },
    ]

    beforeAll(async () => {
      elements = generateElements()
      await addReferences({
        elements,
        defs: fieldNameToTypeMappingDefs,
        fieldsToGroupBy: ['id', 'name'],
        contextStrategyLookup: {
          parentSubject: neighborContextFunc({ contextFieldName: 'subject', levelsUp: 1, contextValueMapper: val => val.replace('_id', '') }),
          parentValue: neighborContextFunc({ contextFieldName: 'value', levelsUp: 2, contextValueMapper: val => val.replace('_id', '') }),
          neighborRef: neighborContextFunc({ contextFieldName: 'ref' }),
          fail: neighborContextFunc({ contextFieldName: 'product', contextValueMapper: () => { throw new Error('fail') } }),
        },
      })
    })

    it('should not crash when context function throws an error', async () => {
      // nothing to check really - just making sure the field was not removed
      const inst = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'inst1'
      )[0] as InstanceElement
      expect(inst.value.fail).toEqual('fail')
    })
    it('should not crash when a matching rule has a too-high levelsUp value', async () => {
      // nothing to check really - just making sure the field was not removed
      const inst = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'inst1'
      )[0] as InstanceElement
      expect(inst.value.value).toEqual('fail')
    })
  })
})
