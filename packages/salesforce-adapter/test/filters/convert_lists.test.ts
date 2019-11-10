import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes,
} from 'adapter-api'
import makeFilter from '../../src/filters/convert_lists'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('convert lists filter', () => {
  const { client } = mockClient()

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      lst: new Field(mockObjId, 'lst', BuiltinTypes.STRING),
      single: new Field(mockObjId, 'single', BuiltinTypes.STRING),
    },
  })

  const mockInstanceLst = new InstanceElement(
    'test_inst_with_list',
    mockType,
    {
      lst: ['val1', 'val2'],
      single: 'val',
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

  let testElements: Element[]

  const filter = makeFilter({ client }) as FilterWith<'onFetch'>

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
  })
})
