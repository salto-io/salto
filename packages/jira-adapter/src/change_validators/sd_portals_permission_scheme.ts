/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isEqualValues,
  isInstanceChange,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isPermissionSchemeStructure, PermissionHolder } from '../filters/permission_scheme/omit_permissions_common'
import { PERMISSION_SCHEME_TYPE_NAME } from '../constants'

const { awu } = collections.asynciterable

export const UNSUPPORTED_PERMISSION_SCHEMES: PermissionHolder[] = [
  {
    holder: {
      type: 'sd.customer.portal.only',
    },
    permission: 'VIEW_AGGREGATED_DATA',
  },
  {
    holder: {
      type: 'sd.customer.portal.only',
    },
    permission: 'ARCHIVE_ISSUES',
  },
  {
    holder: {
      type: 'sd.customer.portal.only',
    },
    permission: 'UNARCHIVE_ISSUES',
  },
]

/**
 * Removes invalid permissions of type UNSUPPORTED_PERMISSION_SCHEMES (see above) that fails deploy
 */
export const permissionSchemeValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(
      element => element.elemID.typeName === PERMISSION_SCHEME_TYPE_NAME && element.value.permissions !== undefined,
    )
    .filter(
      element =>
        element.value.permissions.filter(
          (permission: PermissionHolder) =>
            isPermissionSchemeStructure(permission) &&
            UNSUPPORTED_PERMISSION_SCHEMES.some(permissionHolder => isEqualValues(permission, permissionHolder)),
        ).length !== 0,
    )
    .map(async instance => ({
      elemID: instance.elemID,
      severity: 'Warning' as SeverityLevel,
      message: 'Cannot deploy the permission scheme permission',
      detailedMessage: `Jira does not allow granting the permissions 'ARCHIVE_ISSUES', 'UNARCHIVE_ISSUES' and 'VIEW_AGGREGATED_DATA' to 'sd.customer.portal.only'. The permission scheme ${instance.elemID.getFullName()} will be deployed without them`,
    }))
    .toArray()
