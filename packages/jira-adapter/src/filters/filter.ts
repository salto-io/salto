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
import { getChangeData, isAdditionOrModificationChange, isInstanceChange, Change, ChangeDataType, Value } from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

const filter: FilterCreator = () => ({
  name: 'filtersFilter',
  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes.filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(change => getChangeData(change))
      .filter(element => element.elemID.typeName === 'Filter')
      .filter(element => Object.prototype.hasOwnProperty.call(element.value, 'editPermissions') && Array.isArray(element.value.editPermissions))
      .forEach(element => {
        element.value.editPermissions
          .filter((permission: Value) => permission.type === 'user')
          .forEach((permission: Value) => {
            permission.user = {
              accountId: permission.user,
            }
          })
      })
  },

  onDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes.filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(change => getChangeData(change))
      .filter(element => element.elemID.typeName === 'Filter')
      .filter(element => Object.prototype.hasOwnProperty.call(element.value, 'editPermissions') && Array.isArray(element.value.editPermissions))
      .forEach(element => {
        element.value.editPermissions
          .filter((permission: Value) => permission.type === 'user')
          .forEach((permission: Value) => {
            permission.user = permission.user.accountId
          })
      })
  },
})

export default filter
