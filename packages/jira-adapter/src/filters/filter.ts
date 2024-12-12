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
import { SHARE_PERMISSION_FIELDS } from '../constants'

type ChangeFormatFunction = (permission: Value) => void

const toDeploymentFormat = (permission: Value): void => {
  permission.user = {
    accountId: permission.user,
  }
}

const toNaclFormat = (permission: Value): void => {
  permission.user = permission.user.accountId
}

const changePermissionFieldFormat = (changes: Change<ChangeDataType>[], changeFunction: ChangeFormatFunction): void => {
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === 'Filter')
    .forEach(instance => {
      SHARE_PERMISSION_FIELDS.forEach(fieldName => {
        if (Array.isArray(instance.value[fieldName])) {
          instance.value[fieldName].filter((permission: Value) => permission.type === 'user').forEach(changeFunction)
        }
      })
    })
}

const filter: FilterCreator = () => ({
  name: 'filtersFilter',
  preDeploy: async (changes: Change<ChangeDataType>[]) => {
    changePermissionFieldFormat(changes, toDeploymentFormat)
  },

  onDeploy: async (changes: Change<ChangeDataType>[]) => {
    changePermissionFieldFormat(changes, toNaclFormat)
  },
})

export default filter
