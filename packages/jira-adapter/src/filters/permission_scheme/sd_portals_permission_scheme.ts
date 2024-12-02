/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ChangeDataType, isEqualValues } from '@salto-io/adapter-api'
import { UNSUPPORTED_PERMISSION_SCHEMES } from '../../change_validators/sd_portals_permission_scheme'
import { FilterCreator } from '../../filter'
import { omitChanges, OmitChangesPredicate, PermissionHolder, addBackPermissions } from './omit_permissions_common'

const sdPermissionSchemePredicate: OmitChangesPredicate = (permissionScheme: PermissionHolder) =>
  UNSUPPORTED_PERMISSION_SCHEMES.some(permissionHolder => isEqualValues(permissionScheme, permissionHolder))

const filter: FilterCreator = () => {
  let unsupportedPermissionSchemes: Record<string, PermissionHolder[]> = {}
  return {
    name: 'permissionSchemeFilter',
    preDeploy: async (changes: Change<ChangeDataType>[]) => {
      unsupportedPermissionSchemes = omitChanges(changes, sdPermissionSchemePredicate)
    },
    onDeploy: async (changes: Change<ChangeDataType>[]) => {
      addBackPermissions(changes, unsupportedPermissionSchemes)
    },
  }
}

export default filter
