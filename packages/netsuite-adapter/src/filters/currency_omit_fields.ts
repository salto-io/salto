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

import { Change, isInstanceChange, getChangeData, InstanceElement } from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { CURRENCY } from '../constants'
import { FilterWith } from '../filter'

const FIELDS_TO_OMIT = ['currencyPrecision', 'locale', 'formatSample']

const filterCreator = (): FilterWith<'preDeploy'> => ({
  preDeploy: async changes => {
    changes
      .filter(isInstanceChange)
      .filter(async change => getChangeData<InstanceElement>(change).elemID.typeName === CURRENCY)
      .forEach(change => applyFunctionToChangeData<Change<InstanceElement>>(
        change,
        element => {
          FIELDS_TO_OMIT.map(field => delete element.value[field])
          return element
        }
      ))
  },
})

export default filterCreator
