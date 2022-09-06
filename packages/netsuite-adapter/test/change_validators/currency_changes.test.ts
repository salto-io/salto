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
import { ElemID, InstanceElement, ObjectType, BuiltinTypes, toChange } from '@salto-io/adapter-api'
import { NETSUITE } from '../../src/constants'
import currencyFieldValidator from '../../src/change_validators/currency_changes'


describe('Currency changes change  validator', () => {
  describe('Additon changes to currency', () => {
    let instance: InstanceElement
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'currency'),
      fields: {
        name: {
          refType: BuiltinTypes.STRING,
        },
        symbol: {
          refType: BuiltinTypes.STRING,
        },
        isBaseCurrency: {
          refType: BuiltinTypes.BOOLEAN,
        },
        isInactive: {
          refType: BuiltinTypes.BOOLEAN,
        },
        overrideCurrencyFormat: {
          refType: BuiltinTypes.BOOLEAN,
        },
        displaySymbol: {
          refType: BuiltinTypes.STRING,
        },
        symbolPlacement: {
          refType: BuiltinTypes.STRING,
        },
        locale: {
          refType: BuiltinTypes.STRING,
        },
        formatSample: {
          refType: BuiltinTypes.STRING,
        },
        exchangeRate: {
          refType: BuiltinTypes.NUMBER,
        },
        currencyPrecision: {
          refType: BuiltinTypes.STRING,
        },
      },
      annotations: { source: 'soap' },
    })
    beforeEach(async () => {
      instance = new InstanceElement('instance', type,
        {
          name: 'instance',
          symbol: 'ILS',
          isBaseCurrency: false,
          isInactive: false,
          overrideCurrencyFormat: false,
          displaySymbol: '₪',
          symbolPlacement: '_beforeNumber',
          locale: '_israelHebrew',
          formatSample: '₪1234.56',
          exchangeRate: 2.365,
          currencyPrecision: '_two',
        })
    })
    it('should have changeError when deploying a new currency with \'overrideCurrencyFormat\' disabled.', async () => {
      const after = instance.clone()
      const changeErrors = await currencyFieldValidator(
        [toChange({ after })]
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Error')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toContain('The currency\'s \'OVERRIDE CURRENCY FORMAT\' field is disabled and therefore it cannot be deployed.')
    })

    it('shoud not have changeError when deploying a new currency with \'overrideCurrencyFormat\' enabled.', async () => {
      const after = instance.clone()
      after.value.overrideCurrencyFormat = true
      const fieldsToOmit = ['currencyPrecision', 'locale', 'formatSample']
      const changeErrors = await currencyFieldValidator(
        [toChange({ after })]
      )
      expect(changeErrors).toHaveLength(1)
      expect(changeErrors[0].severity).toEqual('Warning')
      expect(changeErrors[0].elemID).toEqual(instance.elemID)
      expect(changeErrors[0].detailedMessage).toContain(`The following fileds: ${fieldsToOmit.join(' ,')}, cannot be deployed and will be skipped. Please edit locale manually in the service.`,)
    })
  })

  // describe('Modification changes to currency', () => {

  // })
})
