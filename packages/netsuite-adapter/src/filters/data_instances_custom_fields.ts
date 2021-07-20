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
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { FilterWith } from '../filter'
import { isDataObjectType } from '../types'
import { castFieldValue, getSoapType } from '../data_elements/custom_fields'
import { CUSTOM_FIELD_PREFIX } from './data_types_custom_fields'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async instance => isDataObjectType(await instance.getType()))
      .forEach(async instance => {
        const type = await instance.getType()
        const customFields = Object.fromEntries(
          await awu(makeArray(instance.value.customFieldList?.customField))
            .map(async value => {
              const fieldName = `${CUSTOM_FIELD_PREFIX}${value.scriptId}`
              const field = type.fields[fieldName]
              return [fieldName, await castFieldValue(value.value, field)]
            })
            .toArray()
        )
        _.assign(instance.value, customFields)
        delete instance.value.customFieldList
      })
  },

  preDeploy: async changes => {
    await awu(changes)
      .forEach(async change =>
        applyFunctionToChangeData(
          change,
          async element => {
            if (!isInstanceElement(element) || !isDataObjectType(await element.getType())) {
              return element
            }
            const customFields = _.pickBy(
              element.value,
              (_value, key) => key.startsWith(CUSTOM_FIELD_PREFIX),
            )
            if (_.isEmpty(customFields)) {
              return element
            }

            element.value.customFieldList = {
              'platformCore:customField': _(customFields)
                .entries()
                .map(([key, customField]) => ({
                  attributes: {
                    scriptId: key.slice(CUSTOM_FIELD_PREFIX.length, key.length),
                    'xsi:type': getSoapType(customField),
                  },
                  'platformCore:value': customField,
                })).value(),
            }

            _(customFields).keys().forEach(key => delete element.value[key])
            return element
          }
        ))
  },
})

export default filterCreator
