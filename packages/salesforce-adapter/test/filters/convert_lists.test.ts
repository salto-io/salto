import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes, Value,
} from 'adapter-api'
import { makeFilter, UnorderedList } from '../../src/filters/convert_lists'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('convert lists filter', () => {
  const { client } = mockClient()

  const mockInnerObjId = new ElemID(constants.SALESFORCE, 'inner')
  const mockFieldType = new ObjectType({
    elemID: mockInnerObjId,
    fields: {
      key: new Field(mockInnerObjId, 'key', BuiltinTypes.STRING),
      value: new Field(mockInnerObjId, 'value', BuiltinTypes.STRING),
    },
  })

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      lst: new Field(mockObjId, 'lst', BuiltinTypes.STRING),
      single: new Field(mockObjId, 'single', BuiltinTypes.STRING),
      unordered: new Field(mockObjId, 'unordered', mockFieldType),
    },
  })

  const mockInstanceLst = new InstanceElement(
    'test_inst_with_list',
    mockType,
    {
      lst: ['val1', 'val2'],
      single: 'val',
      unordered: [
        { key: 'b', value: '1' },
        { key: 'a', value: '2' },
      ],
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

  let testElements: Element[]

  const filter = makeFilter(unorderedLists)({ client }) as FilterWith<'onFetch'>

  beforeEach(() => {
    const typeClone = mockType.clone()
    testElements = [
      typeClone,
      _.assign(_.clone(mockInstanceLst), { type: typeClone }),
      _.assign(_.clone(mockInstanceNonLst), { type: typeClone }),
    ]
  })

  describe('on fetch', () => {
    let type: ObjectType
    let nonLstInst: InstanceElement
    let lstInst: InstanceElement

    beforeEach(async () => {
      await filter.onFetch(testElements)
      type = testElements[0] as ObjectType
      lstInst = testElements[1] as InstanceElement
      nonLstInst = testElements[2] as InstanceElement
    })

    it('should mark fields as list types', () => {
      expect(type.fields.lst.isList).toBe(true)
      expect(type.fields.single.isList).toBe(false)
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
      expect(type.fields.unordered.isList).toBe(true)
      expect(lstInst.value.unordered).toHaveLength(2)
      expect(lstInst.value.unordered.map((item: Value) => item.key)).toEqual(['a', 'b'])
    })
  })
})
