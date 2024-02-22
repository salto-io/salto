/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
        permission: 'ADMINISTER_PROJECTS',
      },
      {
        permission: 'VIEW_PROJECTS',
      },
      {
        permission: 'VIEW_ISSUES',
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
          permission: 'ADMINISTER_PROJECTS',
        },
      ],
    })
  })
})
