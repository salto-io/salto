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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { FILTER_TYPE_NAME, JIRA } from '../../src/constants'
import sharePermissionFilter from '../../src/filters/share_permission'
import { createEmptyType, getFilterParams } from '../utils'

describe('sharePermissionFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let instances: InstanceElement[]
  let instance: InstanceElement
  let dashboardType: ObjectType
  let sharePermissionType: ObjectType
  beforeEach(async () => {
    sharePermissionType = new ObjectType({
      elemID: new ElemID(JIRA, 'SharePermission'),
      fields: {
        type: { refType: BuiltinTypes.STRING },
        other: { refType: BuiltinTypes.STRING },
      },
    })

    dashboardType = new ObjectType({
      elemID: new ElemID(JIRA, 'Dashboard'),
      fields: { sharePermissions: { refType: new ListType(sharePermissionType) } },
    })

    const filterType = createEmptyType(FILTER_TYPE_NAME)

    instance = new InstanceElement('instance', dashboardType, {
      sharePermissions: [
        {
          type: 'loggedin',
        },
      ],
    })

    const instance2 = new InstanceElement('instance2', filterType, {
      sharePermissions: [
        {
          type: 'loggedin',
        },
        {
          type: 'loggedin',
        },
      ],
      editPermissions: [
        {
          type: 'loggedin',
        },
        {
          type: 'loggedin',
        },
        {
          type: 'loggedin',
        },
      ],
    })

    instances = [instance, instance2]

    const elementsSource = buildElementsSourceFromElements([dashboardType])
    filter = sharePermissionFilter(getFilterParams({ elementsSource })) as typeof filter
  })

  it('should replace SharePermission.type from "loggedin" to "authenticated"', async () => {
    await filter.onFetch(instances)
    expect(instance.value).toEqual({ sharePermissions: [{ type: 'authenticated' }] })
    expect(instances[1].value.sharePermissions).toEqual([{ type: 'authenticated' }, { type: 'authenticated' }])
    expect(instances[1].value.editPermissions).toEqual([
      { type: 'authenticated' },
      { type: 'authenticated' },
      { type: 'authenticated' },
    ])
  })
  it('should not replace when SharePermission.type is not "loggedin"', async () => {
    instance.value.sharePermissions[0].type = 'notLoggedIn'
    await filter.onFetch([instance])
    expect(instance.value).toEqual({ sharePermissions: [{ type: 'notLoggedIn' }] })
  })

  it('should not replace when field name isnt "type"', async () => {
    instance.value.sharePermissions[0].type = 'notLoggedIn'
    instance.value.sharePermissions[0].other = 'loggedIn'
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      sharePermissions: [
        {
          type: 'notLoggedIn',
          other: 'loggedIn',
        },
      ],
    })
  })

  it('should remove everything but the id in project', async () => {
    instance.value.sharePermissions[0].type = 'project'
    instance.value.sharePermissions[0].project = {
      id: 1,
      other: 2,
    }
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      sharePermissions: [
        {
          type: 'project',
          project: {
            id: 1,
          },
        },
      ],
    })
  })

  it('should remove everything but the id in projectRole', async () => {
    instance.value.sharePermissions[0].type = 'role'
    instance.value.sharePermissions[0].role = {
      id: 1,
      other: 2,
    }
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      sharePermissions: [
        {
          type: 'role',
          role: {
            id: 1,
          },
        },
      ],
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
    instance.value.sharePermissions[0].type = 'project'
    instance.value.sharePermissions[0].role = {
      id: 1,
    }
    instances[1].value.sharePermissions[0].type = 'project'
    instances[1].value.sharePermissions[0].role = {
      id: 2,
    }
    instances[1].value.sharePermissions[1].type = 'project'
    instances[1].value.sharePermissions[1].role = {
      id: 3,
    }
    instances[1].value.editPermissions[0].type = 'project'
    instances[1].value.editPermissions[0].role = {
      id: 4,
    }
    instances[1].value.editPermissions[1].type = 'project'
    instances[1].value.editPermissions[1].role = {
      id: 5,
    }
    instances[1].value.editPermissions[2].type = 'project'
    instances[1].value.editPermissions[2].role = {
      id: 6,
    }
    await filter.preDeploy([toChange({ after: instance }), toChange({ before: instance, after: instances[1] })])
    expect(instance.value).toEqual({
      sharePermissions: [
        {
          type: 'projectRole',
          role: {
            id: 1,
          },
        },
      ],
    })
    expect(instances[1].value).toEqual({
      sharePermissions: [
        {
          type: 'projectRole',
          role: {
            id: 2,
          },
        },
        {
          type: 'projectRole',
          role: {
            id: 3,
          },
        },
      ],
      editPermissions: [
        {
          type: 'projectRole',
          role: {
            id: 4,
          },
        },
        {
          type: 'projectRole',
          role: {
            id: 5,
          },
        },
        {
          type: 'projectRole',
          role: {
            id: 6,
          },
        },
      ],
    })
  })

  it('Should work for unresolved type', async () => {
    delete instance.refType.type
    instance.value.sharePermissions[0].type = 'project'
    instance.value.sharePermissions[0].role = {
      id: 1,
    }
    await filter.preDeploy([toChange({ after: instance })])
    expect(instance.value).toEqual({
      sharePermissions: [
        {
          type: 'projectRole',
          role: {
            id: 1,
          },
        },
      ],
    })
  })

  it('if there is no role should not change type to projectRole', async () => {
    instance.value.sharePermissions[0].type = 'project'
    await filter.preDeploy([toChange({ after: instance })])
    expect(instance.value).toEqual({
      sharePermissions: [
        {
          type: 'project',
        },
      ],
    })
  })

  it('should change projectRole to project on deploy', async () => {
    instance.value.sharePermissions[0].type = 'projectRole'
    instances[1].value.sharePermissions[0].type = 'projectRole'
    instances[1].value.sharePermissions[1].type = 'projectRole'
    instances[1].value.editPermissions[0].type = 'projectRole'
    instances[1].value.editPermissions[1].type = 'projectRole'
    instances[1].value.editPermissions[2].type = 'projectRole'
    await filter.onDeploy([toChange({ after: instance }), toChange({ before: instance, after: instances[1] })])
    expect(instance.value).toEqual({
      sharePermissions: [
        {
          type: 'project',
        },
      ],
    })
    expect(instances[1].value).toEqual({
      sharePermissions: [
        {
          type: 'project',
        },
        {
          type: 'project',
        },
      ],
      editPermissions: [
        {
          type: 'project',
        },
        {
          type: 'project',
        },
        {
          type: 'project',
        },
      ],
    })
  })

  it('should not change non projectRole types on deploy', async () => {
    instance.value.sharePermissions[0].type = 'user'
    await filter.onDeploy([toChange({ after: instance })])
    expect(instance.value).toEqual({
      sharePermissions: [
        {
          type: 'user',
        },
      ],
    })
  })
})
