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
import { collections } from '@salto-io/lowerdash'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { FilterCreator } from '../filter'
import { FILTER_TYPE_NAME, SHARE_PERMISSION_FIELDS } from '../constants'

const { makeArray } = collections.array
const USER = 'user'

type Permission = {
  type: string
  user: Value
}

const USER_PERMISSION_SCHEME = Joi.object({
  type: Joi.string().valid(USER).required(),
  user: Joi.any().required(),
})

const isUserPermission = createSchemeGuard<Permission>(USER_PERMISSION_SCHEME)

type ChangeFormatFunction = (permission: Permission) => void

const toDeploymentFormat = (permission: Permission): void => {
  permission.user = {
    accountId: permission.user,
  }
}

const toNaclFormat = (permission: Permission): void => {
  permission.user = permission.user.accountId
}

const changePermissionFieldFormat = (changes: Change<ChangeDataType>[], changeFunction: ChangeFormatFunction): void => {
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FILTER_TYPE_NAME)
    .forEach(instance => {
      SHARE_PERMISSION_FIELDS.forEach(fieldName => {
        makeArray(instance.value[fieldName]).filter(isUserPermission).forEach(changeFunction)
      })
    })
}

// handles the permissions format change. The share permission is not relevant for dc, as there is no option for it there
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
