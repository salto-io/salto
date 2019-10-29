import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes,
} from 'adapter-api'
import makeFilter from '../../src/filters/convert_types'
import * as constants from '../../src/constants'
import { bpCase } from '../../src/transformer'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'

describe('convert types filter', () => {
  const { client } = mockClient()

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      str: new Field(mockObjId, 'str', BuiltinTypes.STRING),
      bool: new Field(mockObjId, 'bool', BuiltinTypes.BOOLEAN),
      num: new Field(mockObjId, 'num', BuiltinTypes.NUMBER),
      nullStr: new Field(mockObjId, 'nullStr', BuiltinTypes.STRING),
      numArray: new Field(mockObjId, 'numArray', BuiltinTypes.NUMBER, {}, true),
    },
  })

  const mockInstance = new InstanceElement(
    new ElemID(constants.SALESFORCE, 'test', 'test_inst_with_list'),
    mockType,
    {
      str: 'val',
      bool: 'false',
      num: '12',
      // eslint-disable-next-line @typescript-eslint/camelcase
      nullStr: { '': { xsi_nil: 'true' } },
      numArray: ['12', '13', '14'],
    },
  )

  const mockSettings = new InstanceElement(
    new ElemID(constants.SALESFORCE, 'settings', 'test_settings'),
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, bpCase(constants.SETTINGS_METADATA_TYPE)),
    }),
    {
      setting: 'true',
    },
  )

  let testElements: Element[]

  const filter = makeFilter({ client }) as FilterWith<'onDiscover'>

  beforeEach(() => {
    testElements = [
      mockType,
      _.clone(mockInstance),
      _.clone(mockSettings),
    ]
  })

  describe('on discover', () => {
    let inst: InstanceElement

    beforeEach(async () => {
      await filter.onDiscover(testElements)
      inst = testElements[1] as InstanceElement
    })

    it('should convert primitive types', () => {
      expect(inst.value.str).toEqual('val')
      expect(inst.value.bool).toEqual(false)
      expect(inst.value.num).toEqual(12)
    })

    it('should convert lists in instances', () => {
      expect(inst.value.numArray).toEqual([12, 13, 14])
    })

    it('should convert nulls', () => {
      expect(inst.value.nullStr).toBe(undefined)
    })

    it('should not change settings', () => {
      const settingsInst = testElements[2] as InstanceElement
      expect(settingsInst).toEqual(mockSettings)
    })
  })
})
