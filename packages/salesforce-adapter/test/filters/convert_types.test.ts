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
      values: new Field(mockObjId, 'values', new ObjectType({
        elemID: mockObjId,
        fields: {
          field: new Field(mockObjId, 'field', BuiltinTypes.STRING),
          value: new Field(mockObjId, 'value', BuiltinTypes.STRING),
        },
      }), {}, true),
      numArray: new Field(mockObjId, 'numArray', BuiltinTypes.NUMBER, {}, true),
      picklist: new Field(mockObjId, 'picklist', BuiltinTypes.STRING,
        { [Type.VALUES]: ['a', 'b', 'c'], [Type.RESTRICTION]: { [Type.ENFORCE_VALUE]: true } }),
    },
  })
  const XSI_TYPE = 'xsi_type'
  const UNDERSCORE = '_'
  const EMPTY_STRING = ''
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
      nullStr: { '': { xsi_nil: 'true' } },
      values: [{
        field: 'xsdString',
        value: {
          [UNDERSCORE]: 'stringVal',
          [EMPTY_STRING]: { [XSI_TYPE]: 'xsd:string' },
        },
      },
      {
        field: 'xsdBoolean',
        value: {
          [UNDERSCORE]: 'false',
          [EMPTY_STRING]: { [XSI_TYPE]: 'xsd:boolean' },
        },
      },
      {
        field: 'xsdInt',
        value: {
          [UNDERSCORE]: '6',
          [EMPTY_STRING]: { [XSI_TYPE]: 'xsd:int' },
        },
      },
      {
        field: 'xsdLong',
        value: {
          [UNDERSCORE]: '6.1',
          [EMPTY_STRING]: { [XSI_TYPE]: 'xsd:long' },
        },
      },
      {
        field: 'xsdDouble',
        value: {
          [UNDERSCORE]: '6.2',
          [EMPTY_STRING]: { [XSI_TYPE]: 'xsd:double' },
        },
      }],
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

      it('should convert xsd string', () => {
        expect(inst.value.values[0].field).toEqual('xsdString')
        expect(inst.value.values[0].value).toEqual('stringVal')
      })

      it('should convert xsd boolean', () => {
        expect(inst.value.values[1].field).toEqual('xsdBoolean')
        expect(inst.value.values[1].value).toEqual('false')
      })

      it('should convert xsd int', () => {
        expect(inst.value.values[2].field).toEqual('xsdInt')
        expect(inst.value.values[2].value).toEqual('6')
      })

      it('should convert xsd long', () => {
        expect(inst.value.values[3].field).toEqual('xsdLong')
        expect(inst.value.values[3].value).toEqual('6.1')
      })

      it('should convert xsd double', () => {
        expect(inst.value.values[4].field).toEqual('xsdDouble')
        expect(inst.value.values[4].value).toEqual('6.2')
      })

      it('should not change settings', () => {
        const settingsInst = testElements[2] as InstanceElement
        expect(settingsInst).toEqual(mockSettings)
      })
    })
  })
})
