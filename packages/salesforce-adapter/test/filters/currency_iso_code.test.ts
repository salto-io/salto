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
import {
  Element,
  ObjectType,
  BuiltinTypes,
  ElemID,
  Change,
  toChange,
  getChangeData,
} from '@salto-io/adapter-api'
import {
  buildElementsSourceFromElements,
  findElements as findElementsByID,
} from '@salto-io/adapter-utils'
import currencyIsoCodeFilter from '../../src/filters/currency_iso_code'
import {
  FIELD_TYPE_NAMES,
  SALESFORCE,
  CURRENCY_CODE_TYPE_NAME,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import {
  createValueSetEntry,
  createCustomObjectType,
  findElements,
  defaultFilterContext,
} from '../utils'
import { FilterWith } from './mocks'

type PicklistDefinition = {
  name: string
  values: string[]
}

const createMockElement = (...picklists: PicklistDefinition[]): ObjectType =>
  createCustomObjectType('MockType', {
    fields: {
      Id: { refType: BuiltinTypes.SERVICE_ID },
      Name: { refType: Types.primitiveDataTypes[FIELD_TYPE_NAMES.TEXT] },
      ...Object.fromEntries(
        picklists.map(({ name, values }) => [
          name,
          {
            refType: Types.primitiveDataTypes[FIELD_TYPE_NAMES.PICKLIST],
            annotations: {
              valueSet: values.map((value) =>
                createValueSetEntry(value, false, value, true),
              ),
            },
          },
        ]),
      ),
    },
  })

describe('currencyIsoCode filter', () => {
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  describe('fetch', () => {
    beforeEach(() => {
      filter = currencyIsoCodeFilter({
        config: defaultFilterContext,
      }) as FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
    })
    describe('when there are no currency fields', () => {
      let elements: Element[]
      let originalElement: Element

      beforeEach(async () => {
        elements = [
          createMockElement({
            name: 'Priority',
            values: ['Low', 'Medium', 'High'],
          }),
        ]
        originalElement = elements[0].clone()
        await filter.onFetch(elements)
      })

      it('should not add any elements', () => {
        expect(elements).toHaveLength(1)
      })

      it('should not change the original element', () => {
        const element = elements[0]
        expect(element).toStrictEqual(originalElement)
      })
    })

    describe('when there are currency fields', () => {
      let elements: Element[]
      let targetElemID: ElemID

      beforeEach(async () => {
        elements = [
          createMockElement(
            { name: 'Priority', values: ['Low', 'Medium', 'High'] },
            { name: 'CurrencyIsoCode', values: ['USD', 'EUR'] },
          ),
        ]
        targetElemID = elements[0].elemID
        await filter.onFetch(elements)
      })

      it('should create a new type element', () => {
        const currencyCodesType = findElements(
          elements,
          CURRENCY_CODE_TYPE_NAME,
        )
        expect(currencyCodesType).toHaveLength(1)
        expect(currencyCodesType[0]).toMatchObject(
          expect.objectContaining({
            isSettings: true,
            fields: expect.objectContaining({
              valueSet: expect.objectContaining({}),
            }),
            path: [SALESFORCE, 'Types', 'CurrencyIsoCodes'],
          }),
        )
      })

      it('should create a new record with the current currencies', () => {
        const currencyCodeRecord = findElements(
          elements,
          CURRENCY_CODE_TYPE_NAME,
          ElemID.CONFIG_NAME,
        )
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
        const { annotations } = (modifiedElement[0] as ObjectType).fields
          .CurrencyIsoCode
        expect(annotations).not.toHaveProperty('valueSet')
        expect(annotations).toHaveProperty('valueSetName')
      })

      it('should not modify other picklist fields', () => {
        const modifiedElement = [...findElementsByID(elements, targetElemID)]
        expect(modifiedElement).toHaveLength(1)
        expect(modifiedElement[0]).toBeInstanceOf(ObjectType)
        const { annotations } = (modifiedElement[0] as ObjectType).fields
          .Priority
        expect(annotations).toHaveProperty('valueSet')
        expect(annotations).not.toHaveProperty('valueSetName')
      })
    })

    describe('when there are malformed currency values', () => {
      let elements: Element[]
      let targetElemID: ElemID

      beforeEach(async () => {
        elements = [
          createMockElement({ name: 'CurrencyIsoCode', values: ['USD'] }),
        ]
        delete (elements[0] as ObjectType).fields.CurrencyIsoCode.annotations
          .valueSet[0].label
        targetElemID = elements[0].elemID
        await filter.onFetch(elements)
      })
      it('should not modify the picklist', () => {
        const modifiedElement = [...findElementsByID(elements, targetElemID)]
        expect(modifiedElement).toHaveLength(1)
        expect(modifiedElement[0]).toBeInstanceOf(ObjectType)
        const { annotations } = (modifiedElement[0] as ObjectType).fields
          .CurrencyIsoCode
        expect(annotations).toHaveProperty('valueSet')
        expect(annotations).not.toHaveProperty('valueSetName')
      })
    })
    describe('when there are no configured currencies', () => {
      let elements: Element[]
      let targetElemID: ElemID

      beforeEach(async () => {
        elements = [createMockElement({ name: 'CurrencyIsoCode', values: [] })]
        targetElemID = elements[0].elemID
        await filter.onFetch(elements)
      })
      it('should transform the currency iso code as usual', () => {
        const modifiedElement = [...findElementsByID(elements, targetElemID)]
        expect(modifiedElement).toHaveLength(1)
        expect(modifiedElement[0]).toBeInstanceOf(ObjectType)
        const { annotations } = (modifiedElement[0] as ObjectType).fields
          .CurrencyIsoCode
        expect(annotations).not.toHaveProperty('valueSet')
        expect(annotations).toHaveProperty('valueSetName')
      })
      it('should create an empty currency iso codes record', () => {
        const currencyCodeRecord = findElements(
          elements,
          CURRENCY_CODE_TYPE_NAME,
          ElemID.CONFIG_NAME,
        )
        expect(currencyCodeRecord).toHaveLength(1)
        expect(currencyCodeRecord[0]).toMatchObject({
          value: {
            valueSet: [],
          },
        })
      })
    })
  })
  describe('deploy', () => {
    let change: Change<ObjectType>
    beforeEach(async () => {
      const elements = [
        createMockElement(
          { name: 'Priority', values: ['Low', 'Medium', 'High'] },
          { name: 'CurrencyIsoCode', values: ['USD', 'EUR'] },
        ),
      ]
      const filterConfig = defaultFilterContext
      filter = currencyIsoCodeFilter({ config: filterConfig }) as FilterWith<
        'onFetch' | 'preDeploy' | 'onDeploy'
      >
      await filter.onFetch(elements)
      filterConfig.elementsSource = buildElementsSourceFromElements(elements)
      change = toChange({ after: elements[0] })
    })

    describe('preDeploy', () => {
      beforeEach(async () => {
        await filter.preDeploy([change])
      })

      it('should remove the valueSetName annotation', () => {
        expect(
          getChangeData(change).fields.CurrencyIsoCode?.annotations,
        ).not.toHaveProperty('valueSetName')
        expect(
          getChangeData(change).fields.CurrencyIsoCode?.annotations,
        ).not.toHaveProperty('valueSet')
      })
    })

    describe('onDeploy', () => {
      beforeEach(async () => {
        await filter.onDeploy([change])
      })

      it('should restore the valueSetName', () => {
        expect(
          getChangeData(change).fields.CurrencyIsoCode?.annotations,
        ).not.toHaveProperty('valueSet')
        expect(
          getChangeData(change).fields.CurrencyIsoCode?.annotations,
        ).toHaveProperty('valueSetName')
      })
    })
  })
})
