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
import { Field, isInstanceElement, isListType, isObjectType, ListType } from '@salto-io/adapter-api'
import { walkOnElement } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { walkOnUsers, WalkOnUsersCallback } from './account_id/account_id_filter'
import { accountIdInfoType } from './account_id/types'

const { awu } = collections.asynciterable

const USER_TYPE_NAMES = ['User', 'UserBean', 'Board_admins_users']

const simplifyUsers: WalkOnUsersCallback = ({ value, fieldName }): void => {
  if (value[fieldName]?.accountId !== undefined) {
    value[fieldName] = value[fieldName].accountId
  }
}

/**
 * Replaces the user obj with only the account id
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'userFilter',
  onFetch: async elements => {
    await awu(elements)
      .filter(isInstanceElement)
      .forEach(async element => {
        walkOnElement({ element, func: walkOnUsers(simplifyUsers, config) })
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
                  isListType(fieldType) ? new ListType(accountIdInfoType) : accountIdInfoType,
                  field.annotations
                )]
                : [fieldName, field])
            })
            .toArray()
        )
      })
    elements.push(accountIdInfoType)
  },
})

export default filter
