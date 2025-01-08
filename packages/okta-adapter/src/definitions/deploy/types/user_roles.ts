/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { definitions } from '@salto-io/adapter-components'
import { getParents, naclCase, safeJsonStringify } from '@salto-io/adapter-utils'
import { Values, getChangeData, isReferenceExpression } from '@salto-io/adapter-api'

const log = logger(module)

export const USER_ROLE_CHANGE_ID_FIELDS = ['type', 'resource-set', 'role']

export const getRoleId = (values: Values, naclCaseFields = false): string =>
  Object.values(
    _.pick(
      values,
      USER_ROLE_CHANGE_ID_FIELDS.map(f => (naclCaseFields ? naclCase(f) : f)),
    ),
  )
    .filter(v => _.isString(v))
    .join('_')

// Extract removed roles ids from shared context, assigned by removedUserRoleAssignments filter
export const getRoleIdFromSharedContext: definitions.ExtractionParams<
  definitions.deploy.ChangeAndExtendedContext,
  definitions.deploy.ChangeAndExtendedContext
>['context'] = {
  custom:
    () =>
    ({ change, sharedContext }) => {
      const parent = getParents(getChangeData(change))[0]
      if (!isReferenceExpression(parent)) {
        log.error(
          'failed to get context for request, expected parent to be reference, got %s',
          safeJsonStringify(parent),
        )
        return {}
      }
      const changeId = getRoleId(getChangeData(change).value, true)
      const roleId = _.get(sharedContext, [parent.elemID.getFullName(), changeId])
      return { id: roleId, userId: parent.value.user }
    },
}
