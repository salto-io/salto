/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import { currencyType } from '../change_validators/currency_undeployable_fields.test'
import filterCreator, { FIELDS_TO_OMIT } from '../../src/filters/currency_omit_fields'
import { LocalFilterOpts } from '../../src/filter'

describe('currency fields filter', () => {
  it(`should remove the following fields: ${FIELDS_TO_OMIT.join(' ,')}`, async () => {
    const instance = new InstanceElement('instance', currencyType, {
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
    const change = toChange({ after: instance })
    await filterCreator({} as LocalFilterOpts).preDeploy?.([change])
    expect(getChangeData(change).value).toEqual({
      name: 'instance',
      symbol: 'ILS',
      isBaseCurrency: false,
      isInactive: false,
      overrideCurrencyFormat: false,
      displaySymbol: '₪',
      symbolPlacement: '_beforeNumber',
      exchangeRate: 2.365,
    })
  })
})
