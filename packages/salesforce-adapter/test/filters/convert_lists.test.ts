/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  ObjectType, ElemID, InstanceElement, Element, BuiltinTypes, Value,
  isListType, isObjectType, ListType,
} from '@salto-io/adapter-api'
import { makeFilter, UnorderedList } from '../../src/filters/convert_lists'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('convert lists filter', () => {
  const { client } = mockClient()

  const mockObjNoInstancesId = new ElemID(constants.SALESFORCE, 'noInstances')
  const mockTypeNoInstances = new ObjectType({
    elemID: mockObjNoInstancesId,
    fields: [
      { name: 'single', type: BuiltinTypes.STRING },
    ],
  })

  const innerFields = [
    { name: 'key', type: BuiltinTypes.STRING },
    { name: 'list', type: BuiltinTypes.STRING },
  ]

  const mockInnerFieldType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'innerInner'),
    fields: innerFields,
  })

  const fieldTypeFields = [
    { name: 'key', type: BuiltinTypes.STRING },
    { name: 'value', type: BuiltinTypes.STRING },
    { name: 'list', type: BuiltinTypes.STRING },
  ]

  const mockFieldType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'inner'),
    fields: [
      ...fieldTypeFields,
      { name: 'listOfObj', type: mockInnerFieldType },
    ],
  })
  const mockInnerFieldTypeB = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'innerInnerB'),
    fields: innerFields,
  })
  const mockFieldTypeB = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'innerB'),
    fields: [
      ...fieldTypeFields,
      { name: 'listOfObj', type: mockInnerFieldTypeB },
    ],
  })

  const mockObjToSortId = new ElemID(constants.SALESFORCE, 'objToSort')
  const mockTypeToSort = new ObjectType({
    elemID: mockObjToSortId,
    fields: [
      { name: 'sortByMe', type: BuiltinTypes.STRING },
      { name: 'other', type: BuiltinTypes.STRING },
    ],
  })

  const nestedMockObjToSortId = new ElemID(constants.SALESFORCE, 'nestedObjToSort')
  const nestedMockTypeToSort = new ObjectType({
    elemID: nestedMockObjToSortId,
    fields: [
      { name: 'nestedAnnoToSort', type: mockTypeToSort },
    ],
  })

  const mockObjWithAnnotationsId = new ElemID(constants.SALESFORCE, 'objWithAnnotations')
  const mockFieldTypeWithAnnotations = new ObjectType({
    elemID: mockObjWithAnnotationsId,
    annotationTypes: {
      annotationToSort: mockTypeToSort,
      otherAnnotation: mockTypeToSort,
      nestedAnnoToSort: nestedMockTypeToSort,
    },
  })

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: [
      { name: 'lst', type: BuiltinTypes.STRING },
      { name: 'single', type: BuiltinTypes.STRING },
      { name: 'ordered', type: mockFieldType },
      { name: 'unordered', type: mockFieldType },
      { name: 'singleHardcoded', type: BuiltinTypes.STRING },
      { name: 'singleObjHardcoded', type: mockFieldTypeB },
      { name: 'emptyHardcoded', type: BuiltinTypes.STRING },
      {
        name: 'fieldWithAnnotations',
        type: mockFieldTypeWithAnnotations,
        annotations: {
          annotationToSort: [{ sortByMe: 'B', other: 'A' }, { sortByMe: 'A', other: 'B' }],
          otherAnnotation: [{ sortByMe: 'B', other: 'A' }, { sortByMe: 'A', other: 'B' }],
          nestedAnnoToSort: {
            nested: [{ sortByMe: 'B', other: 'A' }, { sortByMe: 'A', other: 'B' }],
          },
        },
      },
    ],
    annotationTypes: {
      objAnnotationToSort: mockTypeToSort,
      otherObjAnnotation: mockTypeToSort,
      nestedObjAnnoToSort: nestedMockTypeToSort,
    },
    annotations: {
      objAnnotationToSort: [{ sortByMe: 'B', other: 'A' }, { sortByMe: 'A', other: 'B' }],
      otherObjAnnotation: [{ sortByMe: 'B', other: 'A' }, { sortByMe: 'A', other: 'B' }],
      nestedObjAnnoToSort: {
        nested: [{ sortByMe: 'B', other: 'A' }, { sortByMe: 'A', other: 'B' }],
      },
    },
  })

  const mockInstanceLst = new InstanceElement(
    'test_inst_with_list',
    mockType,
    {
      lst: ['val1', 'val2'],
      single: 'val',
      ordered: [
        { key: 'b', value: '1', list: ['val1', 'val2'], listOfObj: [{ key: 'b', list: ['val1', 'val2'] }, { key: 'a', list: ['val1', 'val2'] }] },
        { key: 'a', value: '2', list: ['val1', 'val2'], listOfObj: [{ key: 'b', list: ['val1', 'val2'] }, { key: 'a', list: ['val1', 'val2'] }] },
      ],
      unordered: [
        { key: 'b', value: '1', list: ['val1', 'val2'] },
        { key: 'a', value: '2', list: ['val1', 'val2'] },
      ],
      singleHardcoded: 'val',
      singleObjHardcoded: { key: 'b', value: '1', list: ['val1', 'val2'] },
      emptyHardcoded: '',
    }
  )

  const mockInstanceNonLst = new InstanceElement(
    'test_inst_no_list',
    mockType,
    {
      lst: 'val1',
      single: 'val',
    },
  )

  const unorderedListFields: ReadonlyArray<UnorderedList> = [
    {
      elemId: mockType.fields.unordered.elemID,
      orderBy: mockFieldType.fields.key.name,
    },
  ]

  const hardcodedLists: ReadonlyArray<string> = [
    mockType.fields.singleHardcoded.elemID.getFullName(),
    mockType.fields.singleObjHardcoded.elemID.getFullName(),
    mockType.fields.emptyHardcoded.elemID.getFullName(),
    mockTypeNoInstances.fields.single.elemID.getFullName(),
  ]

  const unorderedListAnnotations: ReadonlyArray<UnorderedList> = [
    {
      elemId: new ElemID(constants.SALESFORCE, mockType.elemID.typeName,
        'field', 'fieldWithAnnotations', 'annotationToSort'),
      orderBy: 'sortByMe',
    },
    {
      elemId: new ElemID(constants.SALESFORCE, mockType.elemID.typeName,
        'attr', 'objAnnotationToSort'),
      orderBy: 'sortByMe',
    },
    {
      elemId: new ElemID(constants.SALESFORCE, mockType.elemID.typeName,
        'field', 'fieldWithAnnotations', 'nestedAnnoToSort', 'nested'),
      orderBy: 'sortByMe',
    },
    {
      elemId: new ElemID(constants.SALESFORCE, mockType.elemID.typeName,
        'attr', 'nestedObjAnnoToSort', 'nested'),
      orderBy: 'sortByMe',
    },
  ]

  let testElements: Element[]

  const filter = makeFilter(unorderedListFields, unorderedListAnnotations,
    hardcodedLists)({ client }) as FilterWith<'onFetch'>

  beforeEach(() => {
    const typeClone = mockType.clone()
    const typeNoInstancesClone = mockTypeNoInstances.clone()
    testElements = [
      typeClone,
      typeNoInstancesClone,
      _.assign(_.clone(mockInstanceLst), { type: typeClone }),
      _.assign(_.clone(mockInstanceNonLst), { type: typeClone }),
    ]
  })

  describe('on fetch', () => {
    let type: ObjectType
    let typeNoInstances: ObjectType
    let nonLstInst: InstanceElement
    let lstInst: InstanceElement

    beforeEach(async () => {
      await filter.onFetch(testElements)
      type = testElements[0] as ObjectType
      typeNoInstances = testElements[1] as ObjectType
      lstInst = testElements[2] as InstanceElement
      nonLstInst = testElements[3] as InstanceElement
    })

    it('should mark fields as list types', () => {
      expect(isListType(type.fields.lst.type)).toBeTruthy()
      expect(isListType(type.fields.single.type)).toBeFalsy()
    })

    it('should convert lists in instances', () => {
      expect(lstInst.value.lst).toEqual(['val1', 'val2'])
      expect(nonLstInst.value.lst).toEqual(['val1'])
    })

    it('should leave non lists unchanged', () => {
      expect(lstInst.value.single).toEqual('val')
      expect(nonLstInst.value.single).toEqual('val')
    })

    it('should sort unordered lists', () => {
      expect(isListType(type.fields.unordered.type)).toBeTruthy()
      expect(lstInst.value.unordered).toHaveLength(2)
      expect(lstInst.value.unordered.map((item: Value) => item.key)).toEqual(['a', 'b'])
    })

    it('should not reorder regular lists', () => {
      expect(isListType(type.fields.ordered.type)).toBeTruthy()
      expect(lstInst.value.ordered).toHaveLength(2)
      expect(lstInst.value.ordered).toEqual(mockInstanceLst.value.ordered)
    })

    it('should convert list inside objs in lists', () => {
      expect(isListType(type.fields.ordered.type)).toBeTruthy()
      const { innerType } = (type.fields.ordered.type as ListType)
      expect(isObjectType(innerType)).toBeTruthy()
      expect(isListType((innerType as ObjectType).fields.list.type)).toBeTruthy()
    })

    it('should convert list inside objs in list inside list of obj', () => {
      expect(isListType(type.fields.ordered.type)).toBeTruthy()
      const { innerType } = (type.fields.ordered.type as ListType)
      expect(isObjectType(innerType)).toBeTruthy()
      expect(isListType((innerType as ObjectType).fields.listOfObj.type)).toBeTruthy()
      const innerInnerType = ((innerType as ObjectType).fields.listOfObj.type as ListType).innerType
      expect(isObjectType(innerInnerType)).toBeTruthy()
      expect(isListType((innerInnerType as ObjectType).fields.list.type)).toBeTruthy()
    })

    it('should convert hardcoded fields to lists', () => {
      expect(isListType(type.fields.singleHardcoded.type)).toBeTruthy()
      expect(lstInst.value.singleHardcoded).toEqual(['val'])
    })

    it('should convert a list inside an hardcoded field to list', () => {
      const hardcodedObjType = type.fields.singleObjHardcoded.type
      expect(isListType(hardcodedObjType)).toBeTruthy()
      const innerObj = (hardcodedObjType as ListType).innerType
      expect(isObjectType(innerObj)).toBeTruthy()
      expect(isListType((innerObj as ObjectType).fields.list.type)).toBeTruthy()
    })

    it('should convert val of a list inside an hardcoded field to list', () => {
      expect(lstInst.value.singleObjHardcoded).toEqual([{ key: 'b', value: '1', list: ['val1', 'val2'] }])
    })

    it('should convert empty hardcoded fields to empty lists', () => {
      expect(isListType(type.fields.emptyHardcoded.type)).toBeTruthy()
      expect(lstInst.value.emptyHardcoded).toEqual([])
    })

    it('should convert hardcoded fields to lists even when there are no instances', () => {
      expect(isListType(typeNoInstances.fields.single.type)).toBeTruthy()
    })

    it('should sort unordered annotations of fields', () => {
      expect(type.fields.fieldWithAnnotations.annotations.annotationToSort).toHaveLength(2)
      expect(type.fields.fieldWithAnnotations.annotations.annotationToSort).toEqual([
        { sortByMe: 'A', other: 'B' }, { sortByMe: 'B', other: 'A' },
      ])
    })

    it('should not reorder regular annotations of fields', () => {
      expect(type.fields.fieldWithAnnotations.annotations.otherAnnotation).toHaveLength(2)
      expect(type.fields.fieldWithAnnotations.annotations.otherAnnotation).toEqual(
        mockType.fields.fieldWithAnnotations.annotations.otherAnnotation
      )
    })

    it('should sort nested unordered annotations of fields', () => {
      expect(type.fields.fieldWithAnnotations.annotations.nestedAnnoToSort
        .nested).toHaveLength(2)
      expect(type.fields.fieldWithAnnotations.annotations.nestedAnnoToSort.nested).toEqual([
        { sortByMe: 'A', other: 'B' }, { sortByMe: 'B', other: 'A' },
      ])
    })

    it('should sort unordered annotations of types', () => {
      expect(type.annotations.objAnnotationToSort).toHaveLength(2)
      expect(type.annotations.objAnnotationToSort).toEqual([
        { sortByMe: 'A', other: 'B' }, { sortByMe: 'B', other: 'A' },
      ])
    })

    it('should not reorder regular annotations of types', () => {
      expect(type.annotations.otherObjAnnotation).toHaveLength(2)
      expect(type.annotations.otherObjAnnotation).toEqual(
        mockType.annotations.otherObjAnnotation
      )
    })

    it('should sort nested unordered annotations of types', () => {
      expect(type.annotations.nestedObjAnnoToSort.nested).toHaveLength(2)
      expect(type.annotations.nestedObjAnnoToSort.nested).toEqual([
        { sortByMe: 'A', other: 'B' }, { sortByMe: 'B', other: 'A' },
      ])
    })
  })
})
