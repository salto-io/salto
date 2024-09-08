/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { getChangeData, InstanceElement, isAdditionChange, isInstanceChange, Change } from '@salto-io/adapter-api'
import { CURRENCY, EXCHANGE_RATE } from '../constants'
import { LocalFilterCreator } from '../filter'

export const DEFAULT_EXCHANGE_RATE = 1

export const getCurrencyAdditionsWithoutExchangeRate = (changes: ReadonlyArray<Change>): InstanceElement[] =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === CURRENCY)
    .filter(instance => !instance.value[EXCHANGE_RATE])

const filterCreator: LocalFilterCreator = () => ({
  name: 'currencyExchangeRate',
  preDeploy: async changes => {
    getCurrencyAdditionsWithoutExchangeRate(changes).forEach(instance => {
      instance.value[EXCHANGE_RATE] = DEFAULT_EXCHANGE_RATE
    })
  },
})

export default filterCreator
