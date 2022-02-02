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
import { BuiltinTypes, Field, isInstanceElement, isObjectType } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const USER_TYPE_NAME = 'User'

/**
 * Replaces the user obj with only the display name
 */
const filter: FilterCreator = () => ({
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async instance => {
        instance.value = await transformValues({
          values: instance.value,
          type: await instance.getType(),
          strict: false,
          transformFunc: ({ value, field }) => {
            if (field?.refType.elemID.typeName === USER_TYPE_NAME) {
              return value.displayName
            }
            return value
          },
        }) ?? instance.value
      })

    await awu(elements)
      .filter(isObjectType)
      .forEach(async type => {
        type.fields = _.mapValues(
          type.fields,
          field => (field.refType.elemID.typeName === USER_TYPE_NAME
            ? new Field(type, field.name, BuiltinTypes.STRING, field.annotations)
            : field)
        )
      })
  },
})

export default filter
