/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { Element, ObjectType, BuiltinTypes, Field, ElemID } from '@salto-io/adapter-api'
import { findElements as findElementsByID } from '@salto-io/adapter-utils'
import currencyIsoCodeFilter, { CURRENCY_CODE_TYPE_NAME } from '../../src/filters/currency_iso_code'
import { FilterWith } from '../../src/filter'
import { FIELD_TYPE_NAMES, SALESFORCE } from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { createValueSetEntry, createCustomObjectType, findElements } from '../utils'

class MockObjectType extends ObjectType {
  addPickList(name: string, values: string[]): MockObjectType {
    this.fields[name] = new Field(
      this,
      name,
      Types.primitiveDataTypes[FIELD_TYPE_NAMES.PICKLIST],
      { valueSet: values.map(value => createValueSetEntry(value, false, value, true)) },
    )
    return this
  }
}


const mockElement = (): MockObjectType => new MockObjectType(createCustomObjectType('MockType', {
  fields: {
    Id: { refType: BuiltinTypes.SERVICE_ID },
    Name: { refType: Types.primitiveDataTypes[FIELD_TYPE_NAMES.TEXT] },
  },
}))

describe('currencyIsoCode filter', () => {
  const filter = currencyIsoCodeFilter() as FilterWith<'onFetch'>
  let elements: Element[]

  describe('when there are no currency fields', () => {
    let originalElement: Element

    beforeEach(async () => {
      elements = [mockElement().addPickList('Priority', ['Low', 'Medium', 'High'])]
      originalElement = _.cloneDeep(elements[0])
      await filter.onFetch(elements)
    })

    it('should add a new settings type and a new setting instance', () => {
      expect(elements).toHaveLength(3)
    })
    it('should add a correct type', () => {
      const currencyCodesType = findElements(elements, CURRENCY_CODE_TYPE_NAME)
      expect(currencyCodesType).toHaveLength(1)
    })
    it('should add an empty currecy codes ValueSet', () => {
      const currencyCodeRecord = findElements(elements, CURRENCY_CODE_TYPE_NAME, ElemID.CONFIG_NAME)
      expect(currencyCodeRecord).toHaveLength(1)
      expect(currencyCodeRecord[0]).toMatchObject({
        elemID: expect.objectContaining({ adapter: SALESFORCE, idType: 'instance', typeName: CURRENCY_CODE_TYPE_NAME }),
        value: { valueSet: [] },
      })
    })
    it('should not change the original element', () => {
      const element = findElements(elements, 'MockType')[0]
      expect(element).toStrictEqual(originalElement)
    })
  })

  describe('when there are currency fields', () => {
    let targetElemID: ElemID
    beforeEach(async () => {
      elements = [
        mockElement()
          .addPickList('Priority', ['Low', 'Medium', 'High'])
          .addPickList('CurrencyIsoCode', ['USD', 'EUR']),
      ]
      targetElemID = elements[0].elemID
      await filter.onFetch(elements)
    })

    it('should create a new type element', () => {
      const currencyCodesType = findElements(elements, CURRENCY_CODE_TYPE_NAME)
      expect(currencyCodesType).toHaveLength(1)
      expect(currencyCodesType[0]).toMatchObject(expect.objectContaining({
        elemID: expect.objectContaining({ adapter: SALESFORCE, idType: 'type', typeName: CURRENCY_CODE_TYPE_NAME }),
        isSettings: true,
        fields: expect.objectContaining({ valueSet: expect.objectContaining({}) }),
        path: [SALESFORCE, 'Types', 'CurrencyIsoCodes'],
      }))
    })

    it('should create a new record with the current currencies', () => {
      const currencyCodeRecord = findElements(elements, CURRENCY_CODE_TYPE_NAME, ElemID.CONFIG_NAME)
      expect(currencyCodeRecord).toHaveLength(1)

      expect(currencyCodeRecord[0]).toMatchObject({
        path: [SALESFORCE, 'Records', 'Settings', 'CurrencyIsoCodes'],
        value: {
          valueSet: expect.arrayContaining([
            expect.objectContaining({ label: 'USD' }),
            expect.objectContaining({ label: 'EUR' }),
          ]),
        },
      })
    })

    it('should modify the currency code fields', () => {
      const modifiedElement = [...findElementsByID(elements, targetElemID)]
      expect(modifiedElement).toHaveLength(1)
      expect(modifiedElement[0]).toBeInstanceOf(ObjectType)
      const { annotations } = (modifiedElement[0] as ObjectType).fields.CurrencyIsoCode
      expect(annotations).not.toHaveProperty('valueSet')
      expect(annotations).toHaveProperty('valueSetName')
    })

    it('should not modify other picklist fields', () => {
      const modifiedElement = [...findElementsByID(elements, targetElemID)]
      expect(modifiedElement).toHaveLength(1)
      expect(modifiedElement[0]).toBeInstanceOf(ObjectType)
      const { annotations } = (modifiedElement[0] as ObjectType).fields.Priority
      expect(annotations).toHaveProperty('valueSet')
      expect(annotations).not.toHaveProperty('valueSetName')
    })
  })

  describe('when there are malformed currency values', () => {
    let targetElemID: ElemID
    beforeEach(async () => {
      elements = [mockElement().addPickList('CurrencyIsoCode', ['USD'])]
      delete (elements[0] as ObjectType).fields.CurrencyIsoCode.annotations.valueSet[0].label
      targetElemID = elements[0].elemID
      await filter.onFetch(elements)
    })
    it('should not modify the picklist', () => {
      const modifiedElement = [...findElementsByID(elements, targetElemID)]
      expect(modifiedElement).toHaveLength(1)
      expect(modifiedElement[0]).toBeInstanceOf(ObjectType)
      const { annotations } = (modifiedElement[0] as ObjectType).fields.CurrencyIsoCode
      expect(annotations).toHaveProperty('valueSet')
      expect(annotations).not.toHaveProperty('valueSetName')
    })
  })
  describe('when there are no configured currencies', () => {
    let targetElemID: ElemID
    beforeEach(async () => {
      elements = [mockElement().addPickList('CurrencyIsoCode', [])]
      targetElemID = elements[0].elemID
      await filter.onFetch(elements)
    })
    it('should transform the currency iso code as ususal', () => {
      const modifiedElement = [...findElementsByID(elements, targetElemID)]
      expect(modifiedElement).toHaveLength(1)
      expect(modifiedElement[0]).toBeInstanceOf(ObjectType)
      const { annotations } = (modifiedElement[0] as ObjectType).fields.CurrencyIsoCode
      expect(annotations).not.toHaveProperty('valueSet')
      expect(annotations).toHaveProperty('valueSetName')
    })
    it('should create an empty currrency iso codes record', () => {
      const currencyCodeRecord = findElements(elements, CURRENCY_CODE_TYPE_NAME, ElemID.CONFIG_NAME)
      expect(currencyCodeRecord).toHaveLength(1)
      expect(currencyCodeRecord[0]).toMatchObject({
        value: {
          valueSet: [],
        },
      })
    })
  })
})
