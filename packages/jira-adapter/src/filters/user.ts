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
import { BuiltinTypes, Field, isInstanceElement, isListType, isObjectType, ListType } from '@salto-io/adapter-api'
import { transformValues } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'

const { awu } = collections.asynciterable

const USER_TYPE_NAMES = ['User', 'UserBean', 'Board_admins_users']

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
            if (USER_TYPE_NAMES.includes(field?.refType.elemID.typeName ?? '')) {
              return value.displayName
            }
            return value
          },
        }) ?? instance.value
      })

    await awu(elements)
      .filter(isObjectType)
      .forEach(async type => {
        type.fields = Object.fromEntries(
          await awu(Object.entries(type.fields))
            .map(async ([fieldName, field]) => {
              const fieldType = await field.getType()
              const innerType = isListType(fieldType) ? await fieldType.getInnerType() : fieldType

              return (USER_TYPE_NAMES.includes(innerType.elemID.typeName)
                ? [fieldName, new Field(
                  type,
                  field.name,
                  isListType(fieldType) ? new ListType(BuiltinTypes.STRING) : BuiltinTypes.STRING,
                  field.annotations
                )]
                : [fieldName, field])
            })
            .toArray()
        )
      })
  },
})

export default filter
