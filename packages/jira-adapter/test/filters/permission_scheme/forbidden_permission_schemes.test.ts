/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../../src/constants'
import forbiddenPermissionScheme from '../../../src/filters/permission_scheme/forbidden_permission_schemes'
import { getFilterParams } from '../../utils'

describe('forbidden permission scheme', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  const type = new ObjectType({
    elemID: new ElemID(JIRA, 'PermissionScheme'),
  })
  const instance = new InstanceElement('instance', type, {
    permissions: [
      {
        holder: {
          type: 'applicationRole',
        },
        permission: 'ADMINISTER_PROJECTS',
      },
      {
        holder: {
          type: 'applicationRole',
        },
        permission: 'VIEW_PROJECTS',
      },
      {
        holder: {
          type: 'applicationRole',
        },
        permission: 'VIEW_ISSUES',
      },
      {
        holder: {
          type: 'sd.customer.portal.only',
        },
        permission: 'ARCHIVE_ISSUES',
      },
      {
        holder: {
          type: 'applicationRole',
        },
        permission: 'ARCHIVE_ISSUES',
      },
      {
        holder: {
          type: 'sd.customer.portal.only',
        },
        permission: 'UNARCHIVE_ISSUES',
      },
    ],
  })
  beforeEach(async () => {
    filter = forbiddenPermissionScheme(getFilterParams()) as typeof filter
  })
  it('should remove permissions from instances', async () => {
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      permissions: [
        {
          holder: {
            type: 'applicationRole',
          },
          permission: 'ADMINISTER_PROJECTS',
        },
        {
          holder: {
            type: 'applicationRole',
          },
          permission: 'ARCHIVE_ISSUES',
        },
      ],
    })
  })
})
