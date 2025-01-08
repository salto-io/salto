/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { filterUtils } from '@salto-io/adapter-components'
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import removedUserRoleAssignments from '../../src/filters/removed_user_roles_assignments'
import { OKTA, USER_ROLES_TYPE_NAME } from '../../src/constants'
import { getFilterParams } from '../utils'

const mockRequestAllForResource = jest.fn()

jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    fetch: {
      ...actual.fetch,
      request: {
        ...actual.fetch.request,
        getRequester: jest.fn(() => ({
          requestAllForResource: mockRequestAllForResource,
        })),
      },
    },
  }
})

describe('removedUserRoleAssignments', () => {
  type FilterType = filterUtils.FilterWith<'preDeploy'>
  let filter: FilterType
  let userRolesType: ObjectType
  const sharedContext = {}
  beforeEach(() => {
    mockRequestAllForResource
      .mockResolvedValueOnce([
        {
          value: { id: '1', type: 'CUSTOM', role: 'role', 'resource-set': 'resource' },
        },
        { value: { id: '2', type: 'ADMIN' } },
      ])
      .mockResolvedValueOnce([
        {
          value: { id: '3', type: 'ADMIN' },
        },
      ])
    filter = removedUserRoleAssignments(getFilterParams({ sharedContext })) as typeof filter
    userRolesType = new ObjectType({ elemID: new ElemID(OKTA, USER_ROLES_TYPE_NAME) })
  })

  it('should assign current role ids to the shared context', async () => {
    const instA = new InstanceElement('a', userRolesType, { user: 'a' })
    const instB = new InstanceElement('b', userRolesType, { user: 'b' })
    const changes = [toChange({ before: instA }), toChange({ before: instB, after: instB })]
    await filter.preDeploy(changes)
    expect(sharedContext).toEqual({
      [instA.elemID.getFullName()]: {
        CUSTOM_resource_role: '1',
        ADMIN: '2',
      },
      [instB.elemID.getFullName()]: {
        ADMIN: '3',
      },
    })
  })
})
