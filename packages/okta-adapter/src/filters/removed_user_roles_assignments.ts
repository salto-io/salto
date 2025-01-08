/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isInstanceChange, getChangeData, isRemovalOrModificationChange } from '@salto-io/adapter-api'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { definitions as definitionsUtils, fetch as fetchUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { OKTA, USER_ROLES_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { OktaOptions } from '../definitions/types'
import { getRoleId } from '../definitions/deploy/types/user_roles'

const log = logger(module)
const { awu } = collections.asynciterable

/**
 * When removing a user role, the removed role id must be provided.
 * As the role id is not persisted on the element, we make an API request to get the current roles,
 * and keeps a mapping between the user roles to thier ids in the shared context, to be used during deploy.
 */
const filterCreator: FilterCreator = ({ definitions, sharedContext }) => ({
  name: 'removedUserRoleAssignments',
  preDeploy: async changes => {
    const requester = fetchUtils.request.getRequester<OktaOptions>({
      adapterName: OKTA,
      clients: definitions.clients,
      pagination: definitions.pagination,
      requestDefQuery: definitionsUtils.queryWithDefault(
        definitionsUtils.getNestedWithDefault(definitions.fetch?.instances ?? {}, 'requests'),
      ),
    })
    await awu(changes)
      .filter(isInstanceChange)
      .filter(isRemovalOrModificationChange)
      .map(change => getChangeData(change))
      .filter(instance => instance.elemID.typeName === USER_ROLES_TYPE_NAME)
      .forEach(async instance => {
        const { user } = instance.value
        try {
          const response = await requester.requestAllForResource({
            callerIdentifier: { typeName: 'UserRole' },
            contextPossibleArgs: { id: [user] },
          })
          const roles = response.map(({ value }) => ({ [getRoleId(value)]: _.get(value, 'id') }))
          _.assign(sharedContext, { [instance.elemID.getFullName()]: _.merge({}, ...roles) })
        } catch (e) {
          log.error(
            'Failed to fetch user roles for %s: %s',
            instance.elemID.getFullName(),
            safeJsonStringify(e.message),
          )
        }
      })
  },
})

export default filterCreator
