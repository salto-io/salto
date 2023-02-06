/*
*                      Copyright 2023 Salto Labs Ltd.
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

import { getChangeData, InstanceElement, isAdditionChange, isInstanceChange, Change } from '@salto-io/adapter-api'
import { CURRENCY, EXCHANGE_RATE } from '../constants'
import { FilterWith } from '../filter'

export const DEFAULT_EXCHANGE_RATE = 1

export const getCurrencyAdditionsWithoutExchangeRate = (
  changes: ReadonlyArray<Change>
): InstanceElement[] => (
  changes
    .filter(isInstanceChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === CURRENCY)
    .filter(instance => !instance.value[EXCHANGE_RATE])
)

const filterCreator = (): FilterWith<'preDeploy'> => ({
  name: 'currencyExchangeRate',
  preDeploy: async changes => {
    getCurrencyAdditionsWithoutExchangeRate(changes)
      .forEach(instance => {
        instance.value[EXCHANGE_RATE] = DEFAULT_EXCHANGE_RATE
      })
  },
})

export default filterCreator
