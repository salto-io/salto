import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes,
} from 'adapter-api'
import filter from '../../src/filters/convert_lists'
import SalesforceClient from '../../src/client/client'
import * as constants from '../../src/constants'

jest.mock('../../src/client/client')

describe('Test convert lists filter', () => {
  const client = new SalesforceClient('', '', false)

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      lst: new Field(mockObjId, 'lst', BuiltinTypes.STRING),
      single: new Field(mockObjId, 'single', BuiltinTypes.STRING),
    },
  })

  const mockInstanceLst = new InstanceElement(
    new ElemID(constants.SALESFORCE, 'test', 'test_inst_with_list'),
    mockType,
    {
      lst: ['val1', 'val2'],
      single: 'val',
    },
  )

  const mockInstanceNonLst = new InstanceElement(
    new ElemID(constants.SALESFORCE, 'test', 'test_inst_no_list'),
    mockType,
    {
      lst: 'val1',
      single: 'val',
    },
  )

  let testElements: Element[]

  beforeEach(() => {
    const typeClone = mockType.clone()
    testElements = [
      typeClone,
      _.assign(_.clone(mockInstanceLst), { type: typeClone }),
      _.assign(_.clone(mockInstanceNonLst), { type: typeClone }),
    ]
  })

  describe('on discover', () => {
    let type: ObjectType
    let nonLstInst: InstanceElement
    let lstInst: InstanceElement

    beforeEach(async () => {
      await filter.onDiscover(client, testElements)
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

  describe('on add', () => {
    it('should have no effect', async () => {
      expect(await filter.onAdd(client, mockType)).toHaveLength(0)
    })
  })

  describe('on update', () => {
    it('should have no effect', async () => {
      expect(await filter.onUpdate(client, mockType, mockType)).toHaveLength(0)
    })
  })

  describe('on remove', () => {
    it('should have no effect', async () => {
      expect(await filter.onRemove(client, mockType)).toHaveLength(0)
    })
  })
})
