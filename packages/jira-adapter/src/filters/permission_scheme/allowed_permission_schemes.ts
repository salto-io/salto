/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../../filter'
import { getAllowedPermissionTypes } from '../../change_validators/permission_type'
import { PermissionHolder, omitChanges, addBackPermissions } from './omit_permissions_common'

const log = logger(module)

const filter: FilterCreator = ({ elementsSource }) => {
  let unsupportedPermissionSchemes: Record<string, PermissionHolder[]> = {}
  return {
    name: 'allowedPermissionsSchemeFilter',
    preDeploy: async changes => {
      const allowedPermissions = await getAllowedPermissionTypes(elementsSource)
      if (!allowedPermissions) {
        log.warn(
          'Could not find allowed permission types for permission Scheme filter. skipping pre deploy permission scheme validations',
        )
      } else {
        unsupportedPermissionSchemes = omitChanges(
          changes,
          (holder: PermissionHolder) => !allowedPermissions.has(holder.permission),
        )
      }
    },
    onDeploy: async changes => {
      addBackPermissions(changes, unsupportedPermissionSchemes)
    },
  }
}
export default filter
