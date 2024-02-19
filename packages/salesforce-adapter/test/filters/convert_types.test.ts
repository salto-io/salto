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
  CORE_ANNOTATIONS,
  ListType,
  createRestriction,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import makeFilter from '../../src/filters/convert_types'
import * as constants from '../../src/constants'
import { defaultFilterContext } from '../utils'
import { FilterWith } from './mocks'

describe('convert types filter', () => {
  const mockObjId = new ElemID(constants.SALESFORCE, 'test')
  const mockType = new ObjectType({
    elemID: mockObjId,
    fields: {
      strAsStr: { refType: BuiltinTypes.STRING },
      strAsNum: { refType: BuiltinTypes.STRING },
      boolAsBool: { refType: BuiltinTypes.BOOLEAN },
      boolAsStr: { refType: BuiltinTypes.BOOLEAN },
      numAsNum: { refType: BuiltinTypes.NUMBER },
      numAsStr: { refType: BuiltinTypes.NUMBER },
      nullStr: { refType: BuiltinTypes.STRING },
      values: {
        refType: new ListType(
          new ObjectType({
            elemID: mockObjId,
            fields: {
              field: { refType: BuiltinTypes.STRING },
              value: { refType: BuiltinTypes.STRING },
            },
          }),
        ),
      },
      numArray: { refType: new ListType(BuiltinTypes.NUMBER) },
      picklist: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: ['a', 'b', 'c'],
          }),
        },
      },
      refToStr: { refType: BuiltinTypes.STRING },
    },
  })
  type XsdValueType = { _: string; $: { 'xsi:type': string } }
  const xsdValue = (val: string, type: string): XsdValueType => ({
    _: val,
    $: { 'xsi:type': type },
  })
  const mockInstance = new InstanceElement('test_inst_with_list', mockType, {
    strAsStr: '1.6',
    strAsNum: 1.6,
    boolAsBool: false,
    boolAsStr: 'false',
    numAsStr: '12',
    numAsNum: 12,
    nullStr: { $: { 'xsi:nil': 'true' } },
    values: [
      {
        field: 'xsdString',
        value: xsdValue('stringVal', 'xsd:string'),
      },
      {
        field: 'xsdBoolean',
        value: xsdValue('false', 'xsd:boolean'),
      },
      {
        field: 'xsdInt',
        value: xsdValue('6', 'xsd:int'),
      },
      {
        field: 'xsdLong',
        value: xsdValue('6.1', 'xsd:long'),
      },
      {
        field: 'xsdDouble',
        value: xsdValue('6.2', 'xsd:double'),
      },
    ],
    numArray: ['12', '13', '14'],
    picklist: '0',
    refToStr: new ReferenceExpression(
      new ElemID(constants.SALESFORCE, 'dummy'),
    ),
    withoutTypeDef: 'withoutTypeDef',
  })

  const mockSettings = new InstanceElement(
    'test_settings',
    new ObjectType({
      elemID: new ElemID(
        constants.SALESFORCE,
        constants.SETTINGS_METADATA_TYPE,
      ),
    }),
    {},
  )

  let testElements: Element[]

  const filter = makeFilter({
    config: defaultFilterContext,
  }) as FilterWith<'onFetch'>

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

      it('should not change references', () => {
        expect(inst.value.refToStr).toBe(mockInstance.value.refToStr)
      })

      it('should not change values that have no type definition', () => {
        expect(inst.value.withoutTypeDef).toBe(
          mockInstance.value.withoutTypeDef,
        )
      })
    })
  })
})
