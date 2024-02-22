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
import _ from 'lodash'
import {
  ObjectType,
  ElemID,
  InstanceElement,
  Element,
  BuiltinTypes,
  Value,
  isListType,
  isObjectType,
  ListType,
  MapType,
  isMapType,
  createRefToElmWithValue,
} from '@salto-io/adapter-api'
import { makeFilter, UnorderedList } from '../../src/filters/convert_lists'
import * as constants from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('convert lists filter', () => {
  const mockObjNoInstancesId = new ElemID(constants.SALESFORCE, 'noInstances')
  const mockTypeNoInstances = new ObjectType({
    elemID: mockObjNoInstancesId,
    fields: {
      single: {
        refType: BuiltinTypes.STRING,
      },
    },
  })

  const innerFields = {
    key: {
      refType: BuiltinTypes.STRING,
    },
    list: {
      refType: BuiltinTypes.STRING,
    },
  }

  const mockInnerFieldType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'innerInner'),
    fields: innerFields,
  })

  const fieldTypeFields = {
    key: {
      refType: BuiltinTypes.STRING,
    },
    value: {
      refType: BuiltinTypes.STRING,
    },
    list: {
      refType: BuiltinTypes.STRING,
    },
    strMap: {
      refType: new MapType(BuiltinTypes.STRING),
    },
  }

  const mockFieldType = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'inner'),
    fields: {
      ...fieldTypeFields,
      listOfObj: {
        refType: mockInnerFieldType,
      },
    },
  })
  const mockInnerFieldTypeB = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'innerInnerB'),
    fields: innerFields,
  })
  const mockFieldTypeB = new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, 'innerB'),
    fields: {
      ...fieldTypeFields,
      listOfObj: {
        refType: mockInnerFieldTypeB,
      },
    },
  })

  const mockObjToSortId = new ElemID(constants.SALESFORCE, 'objToSort')
  const mockTypeToSort = new ObjectType({
    elemID: mockObjToSortId,
    fields: {
      sortByMe: {
        refType: BuiltinTypes.STRING,
      },
      other: {
        refType: BuiltinTypes.STRING,
      },
    },
  })

  const nestedMockObjToSortId = new ElemID(
    constants.SALESFORCE,
    'nestedObjToSort',
  )
  const nestedMockTypeToSort = new ObjectType({
    elemID: nestedMockObjToSortId,
    fields: {
      nestedAnnoToSort: {
        refType: mockTypeToSort,
      },
    },
  })

  const mockObjWithAnnotationsId = new ElemID(
    constants.SALESFORCE,
    'objWithAnnotations',
  )
  const mockFieldTypeWithAnnotations = new ObjectType({
    elemID: mockObjWithAnnotationsId,
    annotationRefsOrTypes: {
      annotationToSort: mockTypeToSort,
      otherAnnotation: mockTypeToSort,
      nestedAnnoToSort: nestedMockTypeToSort,
    },
  })

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockProfileType = new ObjectType({
    elemID: mockObjId,
    fields: {
      applicationVisibilities: {
        refType: new MapType(mockFieldType),
      },
    },
    annotations: {
      [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
    },
  })
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      lst: {
        refType: BuiltinTypes.STRING,
      },
      mockFieldMap: {
        refType: new MapType(mockFieldType),
      },
      single: {
        refType: BuiltinTypes.STRING,
      },
      ordered: {
        refType: mockFieldType,
      },
      unordered: {
        refType: mockFieldType,
      },
      singleHardcoded: {
        refType: BuiltinTypes.STRING,
      },
      singleObjHardcoded: {
        refType: mockFieldTypeB,
      },
      emptyHardcoded: {
        refType: BuiltinTypes.STRING,
      },
      fieldWithAnnotations: {
        refType: mockFieldTypeWithAnnotations,
        annotations: {
          annotationToSort: [
            { sortByMe: 'B', other: 'A' },
            { sortByMe: 'A', other: 'B' },
          ],
          otherAnnotation: [
            { sortByMe: 'B', other: 'A' },
            { sortByMe: 'A', other: 'B' },
          ],
          nestedAnnoToSort: {
            nested: [
              { sortByMe: 'B', other: 'A' },
              { sortByMe: 'A', other: 'B' },
            ],
          },
        },
      },
    },
    annotationRefsOrTypes: {
      objAnnotationToSort: mockTypeToSort,
      otherObjAnnotation: mockTypeToSort,
      nestedObjAnnoToSort: nestedMockTypeToSort,
    },
    annotations: {
      objAnnotationToSort: [
        { sortByMe: 'B', other: 'A' },
        { sortByMe: 'A', other: 'B' },
      ],
      otherObjAnnotation: [
        { sortByMe: 'B', other: 'A' },
        { sortByMe: 'A', other: 'B' },
      ],
      nestedObjAnnoToSort: {
        nested: [
          { sortByMe: 'B', other: 'A' },
          { sortByMe: 'A', other: 'B' },
        ],
      },
    },
  })

  const mockInstanceLst = new InstanceElement('test_inst_with_list', mockType, {
    lst: ['val1', 'val2'],
    mockFieldMap: {
      something: {
        key: 'b',
        value: '1',
        list: ['val1', 'val2'],
        strMap: { a: 'b', c: 'd' },
      },
      else: { key: 'a', value: '2', list: ['val1', 'val2'] },
    },
    single: 'val',
    ordered: [
      {
        key: 'b',
        value: '1',
        list: ['val1', 'val2'],
        listOfObj: [
          { key: 'b', list: ['val1', 'val2'] },
          { key: 'a', list: ['val1', 'val2'] },
        ],
        strMap: { a: 'b', c: 'd' },
      },
      {
        key: 'a',
        value: '2',
        list: ['val1', 'val2'],
        listOfObj: [
          { key: 'b', list: ['val1', 'val2'] },
          { key: 'a', list: ['val1', 'val2'] },
        ],
      },
    ],
    unordered: [
      { key: 'b', value: '1', list: ['val1', 'val2'] },
      { key: 'a', value: '2', list: ['val1', 'val2'] },
    ],
    singleHardcoded: 'val',
    singleObjHardcoded: { key: 'b', value: '1', list: ['val1', 'val2'] },
    emptyHardcoded: '',
  })

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
      elemID: mockType.fields.unordered.elemID,
      orderBy: mockFieldType.fields.key.name,
    },
  ]

  const hardcodedLists: ReadonlyArray<string> = [
    mockType.fields.singleHardcoded.elemID.getFullName(),
    mockType.fields.singleObjHardcoded.elemID.getFullName(),
    mockType.fields.emptyHardcoded.elemID.getFullName(),
    mockTypeNoInstances.fields.single.elemID.getFullName(),
    mockType.fields.mockFieldMap.elemID.getFullName(),
  ]

  const unorderedListAnnotations: ReadonlyArray<UnorderedList> = [
    {
      elemID: new ElemID(
        constants.SALESFORCE,
        mockType.elemID.typeName,
        'field',
        'fieldWithAnnotations',
        'annotationToSort',
      ),
      orderBy: 'sortByMe',
    },
    {
      elemID: new ElemID(
        constants.SALESFORCE,
        mockType.elemID.typeName,
        'attr',
        'objAnnotationToSort',
      ),
      orderBy: 'sortByMe',
    },
    {
      elemID: new ElemID(
        constants.SALESFORCE,
        mockType.elemID.typeName,
        'field',
        'fieldWithAnnotations',
        'nestedAnnoToSort',
        'nested',
      ),
      orderBy: 'sortByMe',
    },
    {
      elemID: new ElemID(
        constants.SALESFORCE,
        mockType.elemID.typeName,
        'attr',
        'nestedObjAnnoToSort',
        'nested',
      ),
      orderBy: 'sortByMe',
    },
  ]

  let testElements: Element[]

  const filter = makeFilter(
    unorderedListFields,
    unorderedListAnnotations,
    hardcodedLists,
  )({ config: defaultFilterContext }) as FilterWith<'onFetch'>

  beforeEach(() => {
    const typeClone = mockType.clone()
    const typeNoInstancesClone = mockTypeNoInstances.clone()
    testElements = [
      typeClone,
      typeNoInstancesClone,
      _.assign(_.clone(mockInstanceLst), {
        refType: createRefToElmWithValue(typeClone),
      }),
      _.assign(_.clone(mockInstanceNonLst), {
        refType: createRefToElmWithValue(typeClone),
      }),
      mockProfileType,
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

    it('should mark fields as list types', async () => {
      expect(isListType(await type.fields.lst.getType())).toBeTruthy()
      expect(isListType(await type.fields.single.getType())).toBeFalsy()
    })

    it('should not mark map fields as list types', async () => {
      expect(isListType(await type.fields.mockFieldMap.getType())).toBeFalsy()
      expect(isMapType(await type.fields.mockFieldMap.getType())).toBeTruthy()
    })

    it('should convert lists in instances', () => {
      expect(lstInst.value.lst).toEqual(['val1', 'val2'])
      expect(nonLstInst.value.lst).toEqual(['val1'])
    })

    it('should leave non lists unchanged', () => {
      expect(lstInst.value.single).toEqual('val')
      expect(nonLstInst.value.single).toEqual('val')
      expect(Array.isArray(lstInst.value.mockFieldMap)).toBeFalsy()
    })

    it('should sort unordered lists', async () => {
      expect(isListType(await type.fields.unordered.getType())).toBeTruthy()
      expect(lstInst.value.unordered).toHaveLength(2)
      expect(lstInst.value.unordered.map((item: Value) => item.key)).toEqual([
        'a',
        'b',
      ])
    })

    it('should not reorder regular lists', async () => {
      expect(isListType(await type.fields.ordered.getType())).toBeTruthy()
      expect(lstInst.value.ordered).toHaveLength(2)
      expect(lstInst.value.ordered).toEqual(mockInstanceLst.value.ordered)
    })

    it('should convert list inside objs in lists', async () => {
      expect(isListType(await type.fields.ordered.getType())).toBeTruthy()
      const innerType = await (
        (await type.fields.ordered.getType()) as ListType
      ).getInnerType()
      expect(isObjectType(innerType)).toBeTruthy()
      expect(
        isListType(await (innerType as ObjectType).fields.list.getType()),
      ).toBeTruthy()
    })

    it('should convert list inside objs in list inside list of obj', async () => {
      expect(isListType(await type.fields.ordered.getType())).toBeTruthy()
      const innerType = await (
        (await type.fields.ordered.getType()) as ListType
      ).getInnerType()
      expect(isObjectType(innerType)).toBeTruthy()
      expect(
        isListType(await (innerType as ObjectType).fields.listOfObj.getType()),
      ).toBeTruthy()
      const innerInnerType = await (
        (await (innerType as ObjectType).fields.listOfObj.getType()) as ListType
      ).getInnerType()
      expect(isObjectType(innerInnerType)).toBeTruthy()
      expect(
        isListType(await (innerInnerType as ObjectType).fields.list.getType()),
      ).toBeTruthy()
    })

    it('should convert hardcoded fields to lists', async () => {
      expect(
        isListType(await type.fields.singleHardcoded.getType()),
      ).toBeTruthy()
      expect(lstInst.value.singleHardcoded).toEqual(['val'])
    })

    it('should convert a list inside an hardcoded field to list', async () => {
      const hardcodedObjType = await type.fields.singleObjHardcoded.getType()
      expect(isListType(hardcodedObjType)).toBeTruthy()
      const innerObj = await (hardcodedObjType as ListType).getInnerType()
      expect(isObjectType(innerObj)).toBeTruthy()
      expect(
        isListType(await (innerObj as ObjectType).fields.list.getType()),
      ).toBeTruthy()
    })

    it('should convert val of a list inside an hardcoded field to list', () => {
      expect(lstInst.value.singleObjHardcoded).toEqual([
        { key: 'b', value: '1', list: ['val1', 'val2'] },
      ])
    })

    it('should convert empty hardcoded fields to empty lists', async () => {
      expect(
        isListType(await type.fields.emptyHardcoded.getType()),
      ).toBeTruthy()
      expect(lstInst.value.emptyHardcoded).toEqual([])
    })

    it('should convert hardcoded fields to lists even when there are no instances', async () => {
      expect(
        isListType(await typeNoInstances.fields.single.getType()),
      ).toBeTruthy()
    })

    it('should sort unordered annotations of fields', () => {
      expect(
        type.fields.fieldWithAnnotations.annotations.annotationToSort,
      ).toHaveLength(2)
      expect(
        type.fields.fieldWithAnnotations.annotations.annotationToSort,
      ).toEqual([
        { sortByMe: 'A', other: 'B' },
        { sortByMe: 'B', other: 'A' },
      ])
    })

    it('should not reorder regular annotations of fields', () => {
      expect(
        type.fields.fieldWithAnnotations.annotations.otherAnnotation,
      ).toHaveLength(2)
      expect(
        type.fields.fieldWithAnnotations.annotations.otherAnnotation,
      ).toEqual(
        mockType.fields.fieldWithAnnotations.annotations.otherAnnotation,
      )
    })

    it('should sort nested unordered annotations of fields', () => {
      expect(
        type.fields.fieldWithAnnotations.annotations.nestedAnnoToSort.nested,
      ).toHaveLength(2)
      expect(
        type.fields.fieldWithAnnotations.annotations.nestedAnnoToSort.nested,
      ).toEqual([
        { sortByMe: 'A', other: 'B' },
        { sortByMe: 'B', other: 'A' },
      ])
    })

    it('should sort unordered annotations of types', () => {
      expect(type.annotations.objAnnotationToSort).toHaveLength(2)
      expect(type.annotations.objAnnotationToSort).toEqual([
        { sortByMe: 'A', other: 'B' },
        { sortByMe: 'B', other: 'A' },
      ])
    })

    it('should not reorder regular annotations of types', () => {
      expect(type.annotations.otherObjAnnotation).toHaveLength(2)
      expect(type.annotations.otherObjAnnotation).toEqual(
        mockType.annotations.otherObjAnnotation,
      )
    })

    it('should sort nested unordered annotations of types', () => {
      expect(type.annotations.nestedObjAnnoToSort.nested).toHaveLength(2)
      expect(type.annotations.nestedObjAnnoToSort.nested).toEqual([
        { sortByMe: 'A', other: 'B' },
        { sortByMe: 'B', other: 'A' },
      ])
    })
  })
})
