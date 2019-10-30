import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes, Type,
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
      picklist: new Field(mockObjId, 'picklist', BuiltinTypes.STRING,
        { [Type.VALUES]: ['a', 'b', 'c'], [Type.RESTRICTION]: { [Type.ENFORCE_VALUE]: true } }),
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
      picklist: '0',
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

  describe('on discover', () => {
    describe('convert', () => {
      let inst: InstanceElement

      beforeEach(async () => {
        testElements = [
          _.clone(mockType),
          _.clone(mockInstance),
          _.clone(mockSettings),
        ]
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
      it('should convert enums', () => {
        expect(inst.value.picklist).toBe('a')
      })
    })

    describe('fail to convert enmus', () => {
      beforeEach(() => {
        testElements = [
          _.clone(mockType),
          _.clone(mockInstance),
        ]
      })

      it('should not convert not strict enums', async () => {
        delete (testElements[0] as ObjectType).fields.picklist.annotations[Type.RESTRICTION]
        await filter.onDiscover(testElements)
        expect((testElements[1] as InstanceElement).value.picklist).toBe('0')
      })

      it('should not convert if not an index', async () => {
        (testElements[1] as InstanceElement).value.picklist = 'd'
        await filter.onDiscover(testElements)
        expect((testElements[1] as InstanceElement).value.picklist).toBe('d')
      })

      it('should not convert if not a valid index', async () => {
        (testElements[1] as InstanceElement).value.picklist = '6'
        await filter.onDiscover(testElements)
        expect((testElements[1] as InstanceElement).value.picklist).toBe('6')
      })
    })
  })
})
