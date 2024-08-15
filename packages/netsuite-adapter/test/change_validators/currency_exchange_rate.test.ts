/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { CURRENCY, EXCHANGE_RATE, NETSUITE } from '../../src/constants'
import currencyExchangeRateValidator from '../../src/change_validators/currency_exchange_rate'
import { mockChangeValidatorParams } from '../utils'

const currencyType = new ObjectType({ elemID: new ElemID(NETSUITE, CURRENCY) })

describe('currency exchange rate validator', () => {
  let instance: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement('currency', currencyType, {
      name: 'Canadian Dollar',
      symbol: 'CAD',
      isBaseCurrency: false,
      isInactive: false,
      overrideCurrencyFormat: false,
      displaySymbol: '$',
      symbolPlacement: '_beforeNumber',
      exchangeRate: 40.35,
    })
  })

  it("should have changeError when exchangeRate isn't specified", async () => {
    delete instance.value.exchangeRate
    const changeErrors = await currencyExchangeRateValidator(
      [toChange({ after: instance })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0].severity).toEqual('Warning')
    expect(changeErrors[0].elemID).toEqual(instance.elemID)
    expect(changeErrors[0].detailedMessage).toContain(`'${EXCHANGE_RATE}' is omitted from fetch`)
  })

  it('should not have changeError when exchangeRate is specified', async () => {
    const changeErrors = await currencyExchangeRateValidator(
      [toChange({ after: instance })],
      mockChangeValidatorParams(),
    )
    expect(changeErrors).toHaveLength(0)
  })
})
