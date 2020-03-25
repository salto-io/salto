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
  ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes, Value,
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
    fields: {
      single: new Field(mockObjNoInstancesId, 'single', BuiltinTypes.STRING),
    },
  })

  const mockInnerInnerObjId = new ElemID(constants.SALESFORCE, 'innerInner')
  const mockInnerFieldType = new ObjectType({
    elemID: mockInnerInnerObjId,
    fields: {
      key: new Field(mockInnerInnerObjId, 'key', BuiltinTypes.STRING),
      list: new Field(mockInnerInnerObjId, 'list', BuiltinTypes.STRING),
    },
  })

  const mockInnerObjId = new ElemID(constants.SALESFORCE, 'inner')
  const mockFieldType = new ObjectType({
    elemID: mockInnerObjId,
    fields: {
      key: new Field(mockInnerObjId, 'key', BuiltinTypes.STRING),
      value: new Field(mockInnerObjId, 'value', BuiltinTypes.STRING),
      list: new Field(mockInnerObjId, 'list', BuiltinTypes.STRING),
      listOfObj: new Field(mockInnerObjId, 'innerOfObj', mockInnerFieldType),
    },
  })
  const mockInnerInnerObjIdB = new ElemID(constants.SALESFORCE, 'innerInnerB')
  const mockInnerFieldTypeB = new ObjectType({
    elemID: mockInnerInnerObjIdB,
    fields: {
      key: new Field(mockInnerInnerObjIdB, 'key', BuiltinTypes.STRING),
      list: new Field(mockInnerInnerObjIdB, 'list', BuiltinTypes.STRING),
    },
  })
  const mockInnerObjIdB = new ElemID(constants.SALESFORCE, 'innerB')
  const mockFieldTypeB = new ObjectType({
    elemID: mockInnerObjIdB,
    fields: {
      key: new Field(mockInnerObjIdB, 'keyB', BuiltinTypes.STRING),
      value: new Field(mockInnerObjIdB, 'valueB', BuiltinTypes.STRING),
      list: new Field(mockInnerObjIdB, 'listB', BuiltinTypes.STRING),
      listOfObj: new Field(mockInnerObjIdB, 'innerOfObjB', mockInnerFieldTypeB),
    },
  })

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      lst: new Field(mockObjId, 'lst', BuiltinTypes.STRING),
      single: new Field(mockObjId, 'single', BuiltinTypes.STRING),
      ordered: new Field(mockObjId, 'ordered', mockFieldType),
      unordered: new Field(mockObjId, 'unordered', mockFieldType),
      singleHardcoded: new Field(mockObjId, 'singleHardcoded', BuiltinTypes.STRING),
      singleObjHardcoded: new Field(mockObjId, 'singleObjHardcoded', mockFieldTypeB),
      emptyHardcoded: new Field(mockObjId, 'emptyHardcoded', BuiltinTypes.STRING),
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
    },
  )

  const mockInstanceNonLst = new InstanceElement(
    'test_inst_no_list',
    mockType,
    {
      lst: 'val1',
      single: 'val',
    },
  )

  const unorderedLists: ReadonlyArray<UnorderedList> = [
    {
      fieldId: mockType.fields.unordered.elemID,
      orderBy: mockFieldType.fields.key.name,
    },
  ]

  const hardcodedLists: ReadonlyArray<string> = [
    mockType.fields.singleHardcoded.elemID.getFullName(),
    mockType.fields.singleObjHardcoded.elemID.getFullName(),
    mockType.fields.emptyHardcoded.elemID.getFullName(),
    mockTypeNoInstances.fields.single.elemID.getFullName(),
  ]

  let testElements: Element[]

  const filter = makeFilter(unorderedLists, hardcodedLists)({ client }) as FilterWith<'onFetch'>

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
  })
})
