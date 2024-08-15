/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
  Change,
  ChangeDataType,
  Value,
} from '@salto-io/adapter-api'
import { FilterCreator } from '../filter'

const filter: FilterCreator = () => ({
  name: 'filtersFilter',
  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(change => getChangeData(change))
      .filter(element => element.elemID.typeName === 'Filter')
      .filter(
        element =>
          Object.prototype.hasOwnProperty.call(element.value, 'editPermissions') &&
          Array.isArray(element.value.editPermissions),
      )
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
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(change => getChangeData(change))
      .filter(element => element.elemID.typeName === 'Filter')
      .filter(
        element =>
          Object.prototype.hasOwnProperty.call(element.value, 'editPermissions') &&
          Array.isArray(element.value.editPermissions),
      )
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
