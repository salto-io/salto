/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import authenticatedPermissionFilter from '../../src/filters/authenticated_permission'
import { mockClient, getDefaultAdapterConfig } from '../utils'

describe('authenticatedPermissionFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  beforeEach(async () => {
    const { client, paginator } = mockClient()
    filter = authenticatedPermissionFilter({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    }) as typeof filter

    const sharePermissionType = new ObjectType({
      elemID: new ElemID(JIRA, 'SharePermission'),
      fields: {
        type: { refType: BuiltinTypes.STRING },
        other: { refType: BuiltinTypes.STRING },
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

  it('should replace SharePermission.type from "loggedin" to "authenticated"', async () => {
    await filter.onFetch([instance])
    expect(instance.value).toEqual({ permissions: { type: 'authenticated' } })
  })
  it('should not replace when SharePermission.type is not "loggedin"', async () => {
    instance.value.permissions.type = 'notLoggedIn'
    await filter.onFetch([instance])
    expect(instance.value).toEqual({ permissions: { type: 'notLoggedIn' } })
  })

  it('should not replace when field type isnt SharePermission', async () => {
    type.fields.permissions = new Field(type, 'permissions', BuiltinTypes.UNKNOWN)
    await filter.onFetch([instance])
    expect(instance.value).toEqual({ permissions: { type: 'loggedin' } })
  })

  it('should not replace when field name isnt "type"', async () => {
    instance.value.permissions.type = 'notLoggedIn'
    instance.value.permissions.other = 'loggedIn'
    await filter.onFetch([instance])
    expect(instance.value).toEqual({ permissions: {
      type: 'notLoggedIn',
      other: 'loggedIn',
    } })
  })
})
