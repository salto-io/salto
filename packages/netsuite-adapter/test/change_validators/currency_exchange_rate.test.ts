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

import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { NETSUITE } from '../../src/constants'
import currencyExchangeRateValidator from '../../src/change_validators/currency_exchange_rate'


const currencyType = new ObjectType({
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

describe('currency exchange rate validator', () => {
  const instance = new InstanceElement(
    'currency',
    currencyType,
    {
      name: 'Canadian Dollar',
      symbol: 'CAD',
      isBaseCurrency: false,
      isInactive: false,
      overrideCurrencyFormat: false,
      displaySymbol: '$',
      symbolPlacement: '_beforeNumber',
      exchangeRate: 40.35,
    }
  )

  it('shoulde have changeError when exchangeRate isn\'t specified', async () => {
    const after = instance.clone()
    delete after.value.exchangeRate
    const changeErrors = await currencyExchangeRateValidator(
      [toChange({ after })]
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Error')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
    expect(changeErrors[0].detailedMessage).toContain('\'exchangeRate\' field must be specified when deploying a new curreny')
  })
})
