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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  Element,
  BuiltinTypes,
  isInstanceElement,
  ListType,
  createRefToElmWithValue,
  Field,
} from '@salto-io/adapter-api'
import { GetLookupNameFunc } from '@salto-io/adapter-utils'
import { addReferences, generateLookupFunc } from '../../src/references/field_references'
import {
  FieldReferenceDefinition,
  FieldReferenceResolver,
  ReferenceSerializationStrategy,
  ReferenceSerializationStrategyLookup,
  ReferenceSerializationStrategyName,
} from '../../src/references/reference_mapping'
import { ContextValueMapperFunc, ContextFunc, neighborContextGetter } from '../../src/references'

const ADAPTER_NAME = 'myAdapter'

const neighborContextFunc = (args: {
  contextFieldName: string
  levelsUp?: number
  contextValueMapper?: ContextValueMapperFunc
}): ContextFunc =>
  neighborContextGetter({
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
      productWithName: { refType: BuiltinTypes.STRING },
      fail: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
      ref: { refType: BuiltinTypes.STRING },
    },
  })
  const type2 = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'type2'),
    fields: {
      ref: { refType: BuiltinTypes.NUMBER },
    },
  })
  const ticketFieldType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'ticket_field'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      value: { refType: BuiltinTypes.STRING },
    },
  })
  const triggerType = new ObjectType({
    elemID: new ElemID(ADAPTER_NAME, 'trigger'),
    fields: {
      id: { refType: BuiltinTypes.STRING },
      ticket_field_id: { refType: BuiltinTypes.STRING },
      ref: { refType: BuiltinTypes.STRING },
    },
  })

  const generateElements = (): Element[] => [
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
    type2,
    ticketFieldType,
    triggerType,
    new InstanceElement('productABC', productType, { name: 'ABC' }),
    new InstanceElement('brand1', brandType, { id: 1001 }),
    new InstanceElement('brand2', brandType, { id: 1002 }),
    new InstanceElement('group3', groupType, { id: '2003' }),
    new InstanceElement('group4', groupType, {
      id: '2004',
      basedOnRef: '2003',
      ref: new ReferenceExpression(groupType.elemID),
    }),
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
          values: [{ list: [{ value: '2003' }], type: 'ignore' }],
        },
      ],
      product: 'ABC',
      productWithName: 'ABC',
      fail: 'fail',
      value: 'fail',
      ref: 'ABC',
    }),
    new InstanceElement('inst2', type2, {
      ref: 1001,
    }),
    new InstanceElement('tf1', ticketFieldType, { id: '3001', value: 'field1' }),
    new InstanceElement('trigger1', triggerType, { id: '3002', ticket_field_id: '3001', ref: 'ABC' }),
    new InstanceElement('trigger2', triggerType, { id: '3003', ticket_field_id: '3111' }),
    new InstanceElement('trigger3', triggerType, { id: '3004', ticket_field_id: '' }),
  ]

  describe('addReferences', () => {
    let elements: Element[]
    const fieldNameToTypeMappingDefs: FieldReferenceDefinition<
      'parentSubject' | 'parentValue' | 'neighborRef' | 'fail'
    >[] = [
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
      {
        src: { field: 'productWithName' },
        serializationStrategy: 'nameWithPath',
        target: { type: 'product' },
      },
      {
        src: { field: 'ticket_field_id', parentTypes: ['trigger'] },
        serializationStrategy: 'id',
        target: { type: 'ticket_field' },
        missingRefStrategy: 'typeAndValue',
      },
      // rules with conflicting serialization strategy that don't overlap due to instanceTypes
      {
        src: { field: 'ref', instanceTypes: ['type1'] },
        serializationStrategy: 'nameWithPath',
        target: { type: 'product' },
      },
      {
        src: { field: 'ref', instanceTypes: ['type2'] },
        serializationStrategy: 'id',
        target: { type: 'brand' },
      },
      {
        src: { field: 'ref', instanceTypes: [/^(?!type).*$/] },
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
          parentSubject: neighborContextFunc({
            contextFieldName: 'subject',
            levelsUp: 1,
            contextValueMapper: val => val.replace('_id', ''),
          }),
          parentValue: neighborContextFunc({
            contextFieldName: 'value',
            levelsUp: 2,
            contextValueMapper: val => val.replace('_id', ''),
          }),
          neighborRef: neighborContextFunc({ contextFieldName: 'ref' }),
          fail: neighborContextFunc({
            contextFieldName: 'product',
            contextValueMapper: () => {
              throw new Error('fail')
            },
          }),
        },
      })
    })

    it('should resolve field values when referenced element exists', () => {
      const prof = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'api_access_profile',
      )[0] as InstanceElement
      expect(prof.value.api_client_id).toBeInstanceOf(ReferenceExpression)
      expect(prof.value.api_client_id?.elemID.getFullName()).toEqual('myAdapter.api_client.instance.cli123')
      expect(prof.value.api_collection_ids).toHaveLength(1)
      expect(prof.value.api_collection_ids[0]).toBeInstanceOf(ReferenceExpression)
      expect(prof.value.api_collection_ids[0].elemID.getFullName()).toEqual(
        'myAdapter.api_collection.instance.collection456',
      )

      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder',
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[1].value.parent_id).toBeInstanceOf(ReferenceExpression)
      expect(folders[1].value.parent_id.elemID.getFullName()).toEqual('myAdapter.folder.instance.folder11')

      const inst = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'inst1')[0] as InstanceElement
      expect(inst.value.nestedValues[0].values[0].list[0].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[0].values[0].list[0].value.elemID.getFullName()).toEqual(
        'myAdapter.brand.instance.brand1',
      )
      expect(inst.value.nestedValues[0].values[1].list[1].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[0].values[1].list[1].value.elemID.getFullName()).toEqual(
        'myAdapter.brand.instance.brand2',
      )
      expect(inst.value.nestedValues[1].values[0].list[0].value).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.nestedValues[1].values[0].list[0].value.elemID.getFullName()).toEqual(
        'myAdapter.group.instance.group3',
      )
      expect(inst.value.product).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.product.elemID.getFullName()).toEqual('myAdapter.product.instance.productABC')
      expect(inst.value.productWithName).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.productWithName.elemID.getFullName()).toEqual('myAdapter.product.instance.productABC.name')
    })
    it('should resolve field values when context field is a reference', () => {
      const inst = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'group4')[0] as InstanceElement
      expect(inst.value.basedOnRef).toBeInstanceOf(ReferenceExpression)
      expect(inst.value.basedOnRef.elemID.getFullName()).toEqual('myAdapter.group.instance.group3')
    })
    it('should choose rules based on instanceTypes when specified', () => {
      const inst1 = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'inst1')[0] as InstanceElement
      expect(inst1.value.ref).toBeInstanceOf(ReferenceExpression)
      expect(inst1.value.ref.elemID.getFullName()).toEqual('myAdapter.product.instance.productABC.name')
      const trigger1 = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'trigger1')[0] as InstanceElement
      expect(trigger1.value.ref).toBeInstanceOf(ReferenceExpression)
      expect(trigger1.value.ref.elemID.getFullName()).toEqual('myAdapter.product.instance.productABC')
      const inst2 = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'inst2')[0] as InstanceElement
      expect(inst2.value.ref).toBeInstanceOf(ReferenceExpression)
      expect(inst2.value.ref.elemID.getFullName()).toEqual('myAdapter.brand.instance.brand1')
    })
    it('should not resolve fields in unexpected types even if field name matches', () => {
      const collections = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'api_collection',
      ) as InstanceElement[]
      expect(collections).toHaveLength(2)
      expect(collections[1].value.api_client_id).not.toBeInstanceOf(ReferenceExpression)
      expect(collections[1].value.api_client_id).toEqual(123)
    })
    it('should not resolve fields if values are not identical, even if the only difference is string vs number', () => {
      const inst = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'inst1')[0] as InstanceElement
      expect(inst.value.subjectAndValues[0].valueList[0].value).not.toBeInstanceOf(ReferenceExpression)
      expect(inst.value.subjectAndValues[0].valueList[0].value).toEqual('1001')
    })
    it('should not resolve if referenced element does not exist', () => {
      const folders = elements.filter(
        e => isInstanceElement(e) && e.refType.elemID.name === 'folder',
      ) as InstanceElement[]
      expect(folders).toHaveLength(2)
      expect(folders[0].value.parent_id).not.toBeInstanceOf(ReferenceExpression)
      expect(folders[0].value.parent_id).toEqual('invalid')
    })
    it('should create missing reference if missingRefStrategy provided', async () => {
      const triggerWithMissingReference = elements.filter(
        e => isInstanceElement(e) && e.elemID.name === 'trigger2',
      )[0] as InstanceElement
      expect(triggerWithMissingReference.value.ticket_field_id).toBeInstanceOf(ReferenceExpression)
      expect(triggerWithMissingReference.value.ticket_field_id.elemID.name).toEqual('missing_3111')
    })
    describe("'exact' validation strategy", () => {
      const referee = new InstanceElement('referee', ticketFieldType, { id: '1234' })
      let numReferer: InstanceElement
      let otherNumReferer: InstanceElement
      let strReferer: InstanceElement
      const defs: FieldReferenceDefinition<never>[] = [
        {
          src: { field: 'ref', instanceTypes: ['type1'] },
          target: { type: 'ticket_field' },
          serializationStrategy: 'id',
          sourceTransformation: 'exact',
        },
        {
          src: { field: 'ref', instanceTypes: ['type2'] },
          target: { type: 'ticket_field' },
          serializationStrategy: 'id',
          sourceTransformation: 'exact',
        },
      ]
      beforeAll(() => {
        numReferer = new InstanceElement('referer_num', type2, { ref: 1234 })
        otherNumReferer = new InstanceElement('referer_num', type2, { ref: 5678 })
        strReferer = new InstanceElement('referer_str', type1, { ref: '1234' })
      })

      it('should pass validation if the field value is identical to the serialized referred element', async () => {
        await addReferences({ elements: [strReferer, referee], defs })
        expect(strReferer.value.ref?.elemID?.fullName).toEqual('myAdapter.ticket_field.instance.referee')
      })
      it('should fail validation if the values are the same but of different types', async () => {
        await addReferences({ elements: [numReferer, referee], defs })
        expect(numReferer.value.ref).toEqual(1234)
      })
      it('should fail validation if the values are different', async () => {
        await addReferences({ elements: [otherNumReferer, referee], defs })
        expect(otherNumReferer.value.ref).toEqual(5678)
      })
    })
    describe("'asString' validation strategy", () => {
      const referee = new InstanceElement('referee', ticketFieldType, { id: 'SomeName' })
      const numReferee = new InstanceElement('numReferee', ticketFieldType, { id: '1234' })
      let invalidReferer: InstanceElement
      let differentCaseReferer: InstanceElement
      let numReferer: InstanceElement
      const defs: FieldReferenceDefinition<never>[] = [
        {
          src: { field: 'ref', instanceTypes: ['type1'] },
          target: { type: 'ticket_field' },
          serializationStrategy: 'id',
          sourceTransformation: 'asString',
        },
        {
          src: { field: 'ref', instanceTypes: ['type2'] },
          target: { type: 'ticket_field' },
          serializationStrategy: 'id',
          sourceTransformation: 'asString',
        },
      ]
      beforeAll(() => {
        invalidReferer = new InstanceElement('invalid_ref', type1, { ref: 'Blah!' })
        differentCaseReferer = new InstanceElement('different_case_ref', type1, { ref: 'somename' })
        numReferer = new InstanceElement('num_ref', type2, { ref: 1234 })
      })
      it('should pass validation if the values are the same but of different types', async () => {
        await addReferences({ elements: [numReferer, numReferee], defs, fieldsToGroupBy: ['id'] })
        expect(numReferer.value.ref?.elemID?.fullName).toEqual('myAdapter.ticket_field.instance.numReferee')
      })
      it('should fail validation if the values are different', async () => {
        await addReferences({ elements: [invalidReferer, referee], defs, fieldsToGroupBy: ['id'] })
        expect(invalidReferer.value.ref).toEqual('Blah!')
      })
      it('should fail validation if the values are different case', async () => {
        await addReferences({ elements: [differentCaseReferer, referee], defs, fieldsToGroupBy: ['id'] })
        expect(differentCaseReferer.value.ref).toEqual('somename')
      })
    })
    describe("'asCaseInsensitiveString' validation strategy", () => {
      const referee = new InstanceElement('referee', ticketFieldType, { id: 'somename' })
      const numReferee = new InstanceElement('numReferee', ticketFieldType, { id: '1234' })
      let invalidReferer: InstanceElement
      let differentCaseReferer: InstanceElement
      let numReferer: InstanceElement
      const defs: FieldReferenceDefinition<never>[] = [
        {
          src: { field: 'ref', instanceTypes: ['type1'] },
          target: { type: 'ticket_field' },
          serializationStrategy: 'id',
          sourceTransformation: 'asCaseInsensitiveString',
        },
        {
          src: { field: 'ref', instanceTypes: ['type2'] },
          target: { type: 'ticket_field' },
          serializationStrategy: 'id',
          sourceTransformation: 'asCaseInsensitiveString',
        },
      ]
      beforeAll(() => {
        invalidReferer = new InstanceElement('invalid_ref', type1, { ref: 'Blah!' })
        differentCaseReferer = new InstanceElement('different_case_ref', type1, { ref: 'SomeName' })
        numReferer = new InstanceElement('num_ref', type2, { ref: 1234 })
      })
      it('should pass validation if the values are the same except letter case', async () => {
        await addReferences({ elements: [differentCaseReferer, referee], defs, fieldsToGroupBy: ['id'] })
        expect(differentCaseReferer.value.ref?.elemID?.fullName).toEqual('myAdapter.ticket_field.instance.referee')
      })
      it('should pass validation if the values are the same but of different types', async () => {
        await addReferences({ elements: [numReferer, numReferee], defs, fieldsToGroupBy: ['id'] })
        expect(numReferer.value.ref?.elemID?.fullName).toEqual('myAdapter.ticket_field.instance.numReferee')
      })
      it('should fail validation if the values are different', async () => {
        await addReferences({ elements: [invalidReferer, referee], defs, fieldsToGroupBy: ['id'] })
        expect(invalidReferer.value.ref).toEqual('Blah!')
      })
    })
  })

  describe('generateLookupNameFunc', () => {
    let lookupNameFunc: GetLookupNameFunc
    const fieldNameToTypeMappingDefs: FieldReferenceDefinition<
      'parentSubject' | 'parentValue' | 'neighborRef' | 'fail'
    >[] = [
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
      {
        src: { field: 'api_collection_ids', parentTypes: ['api_access_profile'] },
        serializationStrategy: 'id',
        target: { type: 'api_client' },
      },
    ]

    beforeAll(async () => {
      lookupNameFunc = generateLookupFunc(fieldNameToTypeMappingDefs)
    })

    it('should resolve using id strategy when rule is matched', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(
          new ElemID('adapter', 'api_client', 'instance', 'instance'),
          new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'api_client') }), {
            id: 2,
            name: 'name',
          }),
        ),
        field: new Field(
          new ObjectType({ elemID: new ElemID('adapter', 'api_access_profile') }),
          'api_client_id',
          BuiltinTypes.NUMBER,
        ),
        path: new ElemID('adapter', 'somePath'),
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })

      expect(res).toEqual(2)
    })

    it('should resolve using ref value when ref value is not an element', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(new ElemID('adapter', 'api_client', 'instance', 'instance', 'someVal'), 3),
        field: new Field(
          new ObjectType({ elemID: new ElemID('adapter', 'api_access_profile') }),
          'api_client_id',
          BuiltinTypes.NUMBER,
        ),
        path: new ElemID('adapter', 'somePath'),
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })

      expect(res).toEqual(3)
    })

    it('should resolve using the first strategy when multiple strategies are matched', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(
          new ElemID('adapter', 'api_collection', 'instance', 'instance'),
          new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'api_collection') }), {
            id: 2,
            name: 'name',
          }),
        ),
        field: new Field(
          new ObjectType({ elemID: new ElemID('adapter', 'api_access_profile') }),
          'api_collection_ids',
          BuiltinTypes.NUMBER,
        ),
        path: new ElemID('adapter', 'somePath'),
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })

      expect(res).toEqual('name')
    })

    it('should resolve using the reference type', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(
          new ElemID('adapter', 'api_client', 'instance', 'instance'),
          new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'api_collection') }), {
            id: 2,
            name: 'name',
          }),
        ),
        field: new Field(
          new ObjectType({ elemID: new ElemID('adapter', 'api_access_profile') }),
          'api_collection_ids',
          BuiltinTypes.NUMBER,
        ),
        path: new ElemID('adapter', 'somePath'),
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })

      expect(res).toEqual(2)
    })

    it('should resolve using full value strategy when no rule is matched, and clone the values', async () => {
      const inst = new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'someType') }), {
        id: 2,
        name: 'name',
      })
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'instance'), inst),
        field: new Field(
          new ObjectType({ elemID: new ElemID('adapter', 'someType') }),
          'api_collection_ids',
          BuiltinTypes.NUMBER,
        ),
        path: new ElemID('adapter', 'somePath'),
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })

      expect(res).toEqual({ id: 2, name: 'name' })
      res.name = 'bla'
      expect(inst.value).toEqual({ id: 2, name: 'name' })
    })

    it('should resolve using full value strategy when field is undefined', async () => {
      const res = await lookupNameFunc({
        ref: new ReferenceExpression(new ElemID('adapter', 'someType', 'instance', 'instance'), {
          id: 2,
          name: 'name',
        }),
        path: new ElemID('adapter', 'somePath'),
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })

      expect(res).toEqual({ id: 2, name: 'name' })
    })
    it('should resolve using custom resolver if given', async () => {
      type CustomFieldReferenceDefinition = FieldReferenceDefinition<never> & {
        customSerializationStrategy?: 'realId'
      }
      const CustomReferenceSerializationStrategyLookup: Record<
        'realId' | ReferenceSerializationStrategyName,
        ReferenceSerializationStrategy
      > = {
        ...ReferenceSerializationStrategyLookup,
        realId: {
          serialize: ({ ref }) => ref.value.value.realId,
          lookup: val => val,
        },
      }
      class CustomFieldReferenceResolver extends FieldReferenceResolver<never> {
        constructor(def: CustomFieldReferenceDefinition) {
          super({ src: def.src })
          this.serializationStrategy =
            CustomReferenceSerializationStrategyLookup[
              def.customSerializationStrategy ?? def.serializationStrategy ?? 'fullValue'
            ]
          this.target = def.target ? { ...def.target, lookup: this.serializationStrategy.lookup } : undefined
        }
      }
      const customLookupNameFunc = generateLookupFunc(
        [
          {
            src: { field: 'refValue' },
            customSerializationStrategy: 'realId',
            target: { type: 'typeWithDifferentIdField' },
          } as CustomFieldReferenceDefinition,
        ],
        defs => new CustomFieldReferenceResolver(defs),
      )
      const res = await customLookupNameFunc({
        ref: new ReferenceExpression(
          new ElemID('adapter', 'typeWithDifferentIdField', 'instance', 'instance'),
          new InstanceElement(
            'instance',
            new ObjectType({ elemID: new ElemID('adapter', 'typeWithDifferentIdField') }),
            { realId: 2 },
          ),
        ),
        field: new Field(new ObjectType({ elemID: new ElemID('adapter', 'obj2') }), 'refValue', BuiltinTypes.NUMBER),
        path: new ElemID('adapter', 'somePath'),
        element: new InstanceElement('instance', new ObjectType({ elemID: new ElemID('adapter', 'some_type') }), {}),
      })

      expect(res).toEqual(2)
    })
  })
  describe('failure modes', () => {
    let elements: Element[]
    const fieldNameToTypeMappingDefs: FieldReferenceDefinition<
      'parentSubject' | 'parentValue' | 'neighborRef' | 'fail'
    >[] = [
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
          parentSubject: neighborContextFunc({
            contextFieldName: 'subject',
            levelsUp: 1,
            contextValueMapper: val => val.replace('_id', ''),
          }),
          parentValue: neighborContextFunc({
            contextFieldName: 'value',
            levelsUp: 2,
            contextValueMapper: val => val.replace('_id', ''),
          }),
          neighborRef: neighborContextFunc({ contextFieldName: 'ref' }),
          fail: neighborContextFunc({
            contextFieldName: 'product',
            contextValueMapper: () => {
              throw new Error('fail')
            },
          }),
        },
      })
    })

    it('should not crash when context function throws an error', async () => {
      // nothing to check really - just making sure the field was not removed
      const inst = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'inst1')[0] as InstanceElement
      expect(inst.value.fail).toEqual('fail')
    })
    it('should not crash when a matching rule has a too-high levelsUp value', async () => {
      // nothing to check really - just making sure the field was not removed
      const inst = elements.filter(e => isInstanceElement(e) && e.elemID.name === 'inst1')[0] as InstanceElement
      expect(inst.value.value).toEqual('fail')
    })
  })
})
