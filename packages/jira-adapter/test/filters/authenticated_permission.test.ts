/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import authenticatedPermissionFilter from '../../src/filters/authenticated_permission'
import { mockClient, getDefaultAdapterConfig } from '../utils'

describe('authenticatedPermissionFilter', () => {
  let filter: filterUtils.Filter
  let instance: InstanceElement
  let type: ObjectType
  beforeEach(async () => {
    const { client, paginator } = mockClient()
    filter = authenticatedPermissionFilter({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    })

    const sharePermissionType = new ObjectType({
      elemID: new ElemID(JIRA, 'SharePermission'),
      fields: {
        type: { refType: BuiltinTypes.STRING },
      },
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
      fields: { permissions: { refType: sharePermissionType } },
    })

    instance = new InstanceElement(
      'instance',
      type,
      {
        permissions: {
          type: 'loggedin',
        },
      }
    )
  })

  it('should replace "loggedin" to "authenticated" in SharePermission instances', async () => {
    await filter.onFetch?.([instance])
    expect(instance.value).toEqual({ permissions: { type: 'authenticated' } })
  })
  it('should not replace non "loggedin"', async () => {
    instance.value.permissions.type = 'notLoggedIn'
    await filter.onFetch?.([instance])
    expect(instance.value).toEqual({ permissions: { type: 'notLoggedIn' } })
  })

  it('should not replace "loggedin" if type is not SharePermission', async () => {
    delete type.fields.permissions
    await filter.onFetch?.([instance])
    expect(instance.value).toEqual({ permissions: { type: 'loggedin' } })
  })
})
