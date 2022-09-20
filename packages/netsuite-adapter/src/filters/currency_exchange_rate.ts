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

import { getChangeData, isAdditionChange, isInstanceChange } from '@salto-io/adapter-api'
import { FilterWith } from '../filter'

export const DEFAULT_EXCHANGE_RATE = 1

const filterCreator = (): FilterWith<'onDeploy'> => ({
  onDeploy: async changes => {
    (changes)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .filter(change => getChangeData(change).elemID.typeName === 'currency')
      .forEach(change => {
        const instance = getChangeData(change)
        if (!instance.value?.exchangeRate) {
          instance.value.exchangeRate = DEFAULT_EXCHANGE_RATE
        }
      })
  },
})

export default filterCreator
