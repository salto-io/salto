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
