/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { definitions } from '@salto-io/adapter-components'
import { getParents, naclCase, safeJsonStringify, validatePlainObject } from '@salto-io/adapter-utils'
import {
  Change,
  ChangeGroup,
  InstanceElement,
  getChangeData,
  isAdditionChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ROLE_TYPE_NAME } from '../../../constants'

const log = logger(module)

/**
 * When adding a custom role, we must specify permissions for the role.
 * In the role POST request, the permission object must be "flattened" to a list of permission labels.
 * permission conditions, if exist, must be added in a separate request, therefore we store those in the shared context.
 */
export const adjustRoleAdditionChange: definitions.AdjustFunction<
  definitions.deploy.ChangeAndExtendedContext
> = async ({ value, context }) => {
  const { sharedContext, change } = context
  validatePlainObject(value, ROLE_TYPE_NAME)
  const permissions = _.get(value, 'permissions')
  if (!_.isArray(permissions)) {
    log.error('expected permissions to be an array, instead got %s', safeJsonStringify(permissions))
    throw new Error('missing permissions for role')
  }
  const mappedPermissions = permissions.map(permission => {
    if (_.isPlainObject(permission?.conditions)) {
      // naclCase permission.label because the label includes dots
      _.set(sharedContext, [getChangeData(change).elemID.getFullName(), naclCase(permission.label)], true)
    }
    return permission.label
  })
  return {
    value: {
      ...value,
      permissions: mappedPermissions,
    },
  }
}

export const isPermissionChangeOfAddedRole = (
  change: Change<InstanceElement>,
  changeGroup: Readonly<ChangeGroup>,
): boolean => {
  const parent = getParents(getChangeData(change))[0]
  const parentName = isReferenceExpression(parent) ? parent.elemID.getFullName() : undefined
  const parentChange = changeGroup.changes.find(c => getChangeData(c).elemID.getFullName() === parentName)
  return parentChange !== undefined && isAdditionChange(parentChange)
}

/**
 * Condition to determine if we should update the role permission.
 * role permission should be updated on Role modification changes, or on Role addition changes that contains permissions with conditions.
 */
export const shouldUpdateRolePermission: definitions.deploy.DeployRequestCondition['custom'] =
  () =>
  ({ change, changeGroup, sharedContext }) => {
    const inst = getChangeData(change)
    const parent = getParents(inst)[0]
    const parentName = isReferenceExpression(parent) ? parent.elemID.getFullName() : undefined
    if (parentName !== undefined && isPermissionChangeOfAddedRole(change, changeGroup)) {
      // only make request for permission that their "conditions" were not deployed yet
      if (_.get(sharedContext, [parentName, naclCase(inst.value.label)]) === true) {
        log.debug('deploying permission condition for %s', getChangeData(change).elemID.getFullName())
        return true
      }
      return false
    }
    return true
  }
