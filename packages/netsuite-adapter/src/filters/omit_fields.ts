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
import _ from 'lodash'
import { isInstanceElement } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator, FilterWith } from '../filter'
import { FieldToOmitParams } from '../query'

const { awu } = collections.asynciterable

const FIELDS_TO_OMIT: FieldToOmitParams[] = []

const filterCreator: FilterCreator = ({ config }): FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    console.log(config)
    const fieldsToOmitByType = _(FIELDS_TO_OMIT)
      // concating the user config with the default config will let the
      // user to override only specific types configuration without
      // writing the whole default config in the adapter config
      .concat(config.fetch?.fieldsToOmit ?? [])
      .filter(params => params.fields.length > 0)
      .keyBy(params => params.type)
      .mapValues(params => params.fields)
      .value()

    if (_.isEmpty(fieldsToOmitByType)) {
      return
    }

    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        console.log(fieldsToOmitByType)
        const updatedValues = instance.elemID.typeName in fieldsToOmitByType
          ? _.omit(instance.value, fieldsToOmitByType[instance.elemID.typeName])
          : instance.value
        instance.value = await transformValues({
          values: updatedValues,
          type: await instance.getType(),
          transformFunc: async ({ value, field }) => {
            const fieldType = await field?.getType()
            if (fieldType && fieldType.elemID.name in fieldsToOmitByType) {
              return _.omit(value, fieldsToOmitByType[fieldType.elemID.name])
            }
            return value
          },
          strict: false,
        }) ?? {}
      })
  },
})

export default filterCreator
