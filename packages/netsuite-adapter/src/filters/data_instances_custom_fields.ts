/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { isInstanceElement } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { isDataObjectType } from '../types'
import { castFieldValue } from '../data_elements/custom_fields'
import { FilterWith } from '../filter'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const filterCreator = (): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async instance => isDataObjectType(await instance.getType()))
      .forEach(async instance => {
        const type = await instance.getType()
        const customFields = Object.fromEntries(
          await awu(makeArray(instance.value.customFieldList?.customField))
            .map(async value => {
              const field = type.fields[value.scriptId]
              return [value.scriptId, await castFieldValue(value.value, field)]
            })
            .toArray()
        )
        _.assign(instance.value, customFields)
        delete instance.value.customFieldList
      })
  },
})

export default filterCreator
