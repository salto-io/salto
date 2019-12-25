import _ from 'lodash'
import {
  ObjectType, ElemID, InstanceElement, Element, Field, BuiltinTypes, Type,
} from 'adapter-api'
import makeFilter from '../../src/filters/convert_types'
import * as constants from '../../src/constants'
import { bpCase } from '../../src/transformers/transformer'
import { FilterWith } from '../../src/filter'
import { SETTINGS_METADATA_TYPE } from '../../src/filters/settings_type'
import mockClient from '../client'

describe('convert types filter', () => {
  const { client } = mockClient()

  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      strAsStr: new Field(mockObjId, 'strAsStr', BuiltinTypes.STRING),
      strAsNum: new Field(mockObjId, 'strAsNum', BuiltinTypes.STRING),
      boolAsBool: new Field(mockObjId, 'boolAsBool', BuiltinTypes.BOOLEAN),
      boolAsStr: new Field(mockObjId, 'boolAsStr', BuiltinTypes.BOOLEAN),
      numAsNum: new Field(mockObjId, 'numAsNum', BuiltinTypes.NUMBER),
      numAsStr: new Field(mockObjId, 'numAsStr', BuiltinTypes.NUMBER),
      nullStr: new Field(mockObjId, 'nullStr', BuiltinTypes.STRING),
      numArray: new Field(mockObjId, 'numArray', BuiltinTypes.NUMBER, {}, true),
      picklist: new Field(mockObjId, 'picklist', BuiltinTypes.STRING,
        { [Type.ANNOTATIONS.VALUES]: ['a', 'b', 'c'], [Type.ANNOTATIONS.RESTRICTION]: { [Type.ANNOTATIONS.ENFORCE_VALUE]: true } }),
    },
  })

  const mockInstance = new InstanceElement(
    'test_inst_with_list',
    mockType,
    {
      strAsStr: '1.6',
      strAsNum: 1.6,
      boolAsBool: false,
      boolAsStr: 'false',
      numAsStr: '12',
      numAsNum: 12,
      // eslint-disable-next-line @typescript-eslint/camelcase
      nullStr: { _: { xsi_nil: 'true' } },
      numArray: ['12', '13', '14'],
      picklist: '0',
    },
  )

  const mockSettings = new InstanceElement(
    'test_settings',
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, bpCase(SETTINGS_METADATA_TYPE)),
    }),
    {},
  )

  let testElements: Element[]

  const filter = makeFilter({ client }) as FilterWith<'onFetch'>

  describe('on fetch', () => {
    describe('convert', () => {
      let inst: InstanceElement

      beforeEach(async () => {
        testElements = [
          _.clone(mockType),
          _.clone(mockInstance),
          _.clone(mockSettings),
        ]
        await filter.onFetch(testElements)
        inst = testElements[1] as InstanceElement
      })

      it('should convert primitive types', () => {
        expect(inst.value.strAsStr).toEqual('1.6')
        expect(inst.value.strAsNum).toEqual('1.6')
        expect(inst.value.boolAsBool).toEqual(false)
        expect(inst.value.boolAsStr).toEqual(false)
        expect(inst.value.numAsStr).toEqual(12)
        expect(inst.value.numAsNum).toEqual(12)
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
})
