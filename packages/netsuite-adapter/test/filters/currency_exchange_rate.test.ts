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

import { ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator, { DEFAULT_EXCHANGE_RATE } from '../../src/filters/currency_exchange_rate'
import { CURRENCY, NETSUITE } from '../../src/constants'
import { LocalFilterOpts } from '../../src/filter'

const currencyType = new ObjectType({ elemID: new ElemID(NETSUITE, CURRENCY) })

describe('currency exchange rate filter', () => {
  let instance: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement(CURRENCY, currencyType, {
      name: 'Canadian Dollar',
      symbol: 'CAD',
      isBaseCurrency: false,
      isInactive: false,
      overrideCurrencyFormat: false,
      displaySymbol: '$',
      symbolPlacement: '_beforeNumber',
    })
  })

  it('should not change instance when exchange rate is specified', async () => {
    instance.value.exchangeRate = 0.35
    const change = toChange({ after: instance })
    await filterCreator({} as LocalFilterOpts).preDeploy?.([change])
    expect(getChangeData(change).value.exchangeRate).toEqual(0.35)
  })

  it('should insert exchang rate with default value when it is not specified', async () => {
    const change = toChange({ after: instance })
    await filterCreator({} as LocalFilterOpts).preDeploy?.([change])
    expect(getChangeData(change).value.exchangeRate).toEqual(DEFAULT_EXCHANGE_RATE)
  })
})
