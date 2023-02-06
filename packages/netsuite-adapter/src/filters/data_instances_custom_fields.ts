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
import { isInstanceChange, isInstanceElement, isModificationChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterWith } from '../filter'
import { isCustomFieldName, isDataObjectType, removeCustomFieldPrefix, toCustomFieldName } from '../types'
import { castFieldValue, getSoapType } from '../data_elements/custom_fields'
import { XSI_TYPE } from '../client/constants'
import { getDifferentKeys } from './data_instances_diff'
import { SOAP_SCRIPT_ID } from '../constants'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

const filterCreator = (): FilterWith<'onFetch' | 'preDeploy'> => ({
  name: 'dataInstancesCustomFields',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .filter(async instance => isDataObjectType(await instance.getType()))
      .forEach(async instance => {
        const type = await instance.getType()
        const customFields = Object.fromEntries(
          await awu(makeArray(instance.value.customFieldList?.customField))
            .map(async value => {
              const fieldName = toCustomFieldName(value[SOAP_SCRIPT_ID])
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
      .forEach(async change => {
        const differentKeys = isModificationChange(change) && isInstanceChange(change)
          ? getDifferentKeys(change)
          : undefined
        await awu(Object.values(change.data))
          .filter(isInstanceElement)
          .filter(async instance => isDataObjectType(await instance.getType()))
          .forEach(instance => {
            const customFields = _(instance.value)
              .pickBy((_value, key) => isCustomFieldName(key))
              .entries()
              .sortBy(([key]) => key)
              .filter(([key]) => !differentKeys || differentKeys.has(key))
              .map(([key, customField]) => ({
                attributes: {
                  [SOAP_SCRIPT_ID]: removeCustomFieldPrefix(key),
                  [XSI_TYPE]: getSoapType(customField),
                },
                'platformCore:value': customField,
              }))
              .value()

            instance.value = {
              ..._.omitBy(instance.value, (_value, key) => isCustomFieldName(key)),
              ...(!_.isEmpty(customFields)
                ? { customFieldList: { 'platformCore:customField': customFields } }
                : {}),
            }
          })
      })
  },
})

export default filterCreator
