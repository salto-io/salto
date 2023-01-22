/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { JIRA } from '../../src/constants'
import sharePermissionFilter from '../../src/filters/share_permission'
import { getFilterParams } from '../utils'

describe('sharePermissionFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instance: InstanceElement
  let type: ObjectType
  let sharePermissionType: ObjectType
  beforeEach(async () => {
    sharePermissionType = new ObjectType({
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

    const elementsSource = buildElementsSourceFromElements([type])
    filter = sharePermissionFilter(getFilterParams({ elementsSource })) as typeof filter
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

  it('should remove everything but the id in project', async () => {
    instance.value.permissions.type = 'project'
    instance.value.permissions.project = {
      id: 1,
      other: 2,
    }
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      permissions: {
        type: 'project',
        project: {
          id: 1,
        },
      },
    })
  })

  it('should remove everything but the id in projectRole', async () => {
    instance.value.permissions.type = 'role'
    instance.value.permissions.role = {
      id: 1,
      other: 2,
    }
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      permissions: {
        type: 'role',
        role: {
          id: 1,
        },
      },
    })
  })

  it('should add to fetch the relevant types', async () => {
    const elements = [sharePermissionType]
    await filter.onFetch(elements)
    expect((await sharePermissionType.fields.role.getType()).elemID.getFullName()).toBe('jira.ProjectRolePermission')
    expect((await sharePermissionType.fields.project.getType()).elemID.getFullName()).toBe('jira.ProjectPermission')
    expect(elements).toHaveLength(3)
  })

  it('if there is role should change type to projectRole', async () => {
    instance.value.permissions.type = 'project'
    instance.value.permissions.role = {
      id: 1,
    }
    await filter.preDeploy([toChange({ after: instance })])
    expect(instance.value).toEqual({
      permissions: {
        type: 'projectRole',
        role: {
          id: 1,
        },
      },
    })
  })

  it('Should work for unresolved type', async () => {
    delete instance.refType.type
    instance.value.permissions.type = 'project'
    instance.value.permissions.role = {
      id: 1,
    }
    await filter.preDeploy([toChange({ after: instance })])
    expect(instance.value).toEqual({
      permissions: {
        type: 'projectRole',
        role: {
          id: 1,
        },
      },
    })
  })

  it('if there is no role should not change type to projectRole', async () => {
    instance.value.permissions.type = 'project'
    await filter.preDeploy([toChange({ after: instance })])
    expect(instance.value).toEqual({
      permissions: {
        type: 'project',
      },
    })
  })

  it('should change projectRole to project on deploy', async () => {
    instance.value.permissions.type = 'projectRole'
    await filter.onDeploy([toChange({ after: instance })])
    expect(instance.value).toEqual({
      permissions: {
        type: 'project',
      },
    })
  })

  it('should not change non projectRole types on deploy', async () => {
    instance.value.permissions.type = 'user'
    await filter.onDeploy([toChange({ after: instance })])
    expect(instance.value).toEqual({
      permissions: {
        type: 'user',
      },
    })
  })
})
