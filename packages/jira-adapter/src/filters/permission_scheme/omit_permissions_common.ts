/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeDataType,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  Value,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { isPermissionScheme } from './forbidden_permission_schemes'

export const PERMISSION_HOLDER_SCHEME = Joi.object({
  holder: Joi.object({
    type: Joi.string().allow('').required(),
    parameter: Joi.optional(),
  }),
  permission: Joi.string().allow('').required(),
}).unknown(true)

export type PermissionHolder = {
  holder: {
    type: string
    parameter?: Value
  }
  permission: string
}

export type OmitChangesPredicate = (permissionHolder: PermissionHolder) => boolean
export const isPermissionSchemeStructure = createSchemeGuard<PermissionHolder>(
  PERMISSION_HOLDER_SCHEME,
  'Found an invalid Permission Holder in Permission Scheme',
)

export const omitChanges = (
  changes: Change<ChangeDataType>[],
  predicate: OmitChangesPredicate,
): Record<string, PermissionHolder[]> =>
  Object.fromEntries(
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(isPermissionScheme)
      .map((element: InstanceElement) => {
        const permissions: PermissionHolder[] = _.cloneDeep(element.value.permissions)
        _.remove(
          element.value.permissions,
          permissionHolder => isPermissionSchemeStructure(permissionHolder) && predicate(permissionHolder),
        )
        return [element.elemID.getFullName(), permissions]
      }),
  )

export const addBackPermissions = (
  changes: Change<ChangeDataType>[],
  permissionsToAddBack: Record<string, PermissionHolder[]>,
): void => {
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isPermissionScheme)
    .forEach((element: InstanceElement) => {
      if (permissionsToAddBack[element.elemID.getFullName()] !== undefined) {
        element.value.permissions = permissionsToAddBack[element.elemID.getFullName()]
      }
    })
}
