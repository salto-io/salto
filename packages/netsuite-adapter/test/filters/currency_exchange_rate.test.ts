/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
