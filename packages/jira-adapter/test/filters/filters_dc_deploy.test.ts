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
import { BuiltinTypes, ElemID, ElemIdGetter, InstanceElement, ObjectType, toChange, Value } from '@salto-io/adapter-api'
import { mockFunction } from '@salto-io/test-utils'
import { filterUtils } from '@salto-io/adapter-components'
import _ from 'lodash'
import { getFilterParams, mockClient } from '../utils'
import { getDefaultConfig } from '../../src/config/config'
import { JIRA } from '../../src/constants'
import filtersDcDeployFilter from '../../src/filters/filters_dc_deploy'

const verifyEditInstance0 = (
  permissions: Value[],
  offset: number,
  changeToDeploy: boolean
): void => {
  expect(permissions[offset].type).toEqual('user')
  expect(permissions[offset + 1].type).toEqual('group')
  expect(permissions[offset + 1].group.name).toEqual('jira-administrators2')
  expect(permissions[offset + 2].type).toEqual('project')
  expect(permissions[offset + 2].project.id).toEqual('10003')
  if (changeToDeploy) {
    expect(permissions[offset].user.key).toEqual('10109')
    expect(permissions[offset].user.accountId).toBeUndefined()
  } else {
    expect(permissions[offset].user.key).toBeUndefined()
    expect(permissions[offset].user.accountId).toEqual('10109')
  }
}
const verifyShareInstance0 = (permissions: Value[], offset: number): void => {
  expect(permissions[offset].type).toEqual('project')
  expect(permissions[offset].project.id).toEqual('10001')
  expect(permissions[offset + 1].type).toEqual('group')
  expect(permissions[offset + 1].group.name).toEqual('jira-administrators')
  expect(permissions[offset + 2].type).toEqual('project')
  expect(permissions[offset + 2].project.id).toEqual('10000')
}

const verifyInstance1 = (permissions: Value[]): void => {
  expect(permissions[0].type).toEqual('project')
  expect(permissions[0].project.id).toEqual('10011')
}

const verifyInstance2 = (permissions: Value[]): void => {
  expect(permissions[0].type).toEqual('group')
  expect(permissions[0].group.name).toEqual('jira-administrators3')
}

const verifyEditProperties = (permissions: Value[], start: number, offset: number): void => {
  for (let i = start; i < start + offset; i += 1) {
    expect(permissions[i].edit).toBeTrue()
    expect(permissions[i].view).toBeTrue()
  }
}

const verifyShareProperties = (permissions: Value[], start: number, offset: number): void => {
  for (let i = start; i < start + offset; i += 1) {
    expect(permissions[i].edit).toBeFalse()
    expect(permissions[i].view).toBeTrue()
  }
}

const verifyNoProperties = (permissions: Value[]): void => {
  permissions.forEach(permission => {
    expect(permission.edit).toBeUndefined()
    expect(permission.view).toBeUndefined()
  })
}

describe('filters_dc_deploy', () => {
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let instances: InstanceElement[]

  beforeEach(() => {
    const elemIdGetter = mockFunction<ElemIdGetter>()
      .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))

    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))

    const { client, paginator } = mockClient(true)
    filter = filtersDcDeployFilter(getFilterParams({
      client,
      paginator,
      config,
      getElemIdFunc: elemIdGetter,
    })) as typeof filter

    const objectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Filter'),
      fields:
      {
        str: { refType: BuiltinTypes.STRING }, // wrong structure
      },
    })
    const objectWrongType = new ObjectType({
      elemID: new ElemID(JIRA, 'PermissionScheme'),
      fields:
      {
        str: { refType: BuiltinTypes.STRING }, // wrong structure
      },
    })

    instances = []
    instances[0] = new InstanceElement(
      'instance1',
      objectType,
      {
        name: 'name1',
        description: 'descrip1',
        jql: 'text ~ "bla"',
        owner: {
          id: '10000',
        },
        sharePermissions: [
          {
            type: 'project',
            project: {
              id: '10001',
            },
          },
          {
            type: 'group',
            group: {
              name: 'jira-administrators',
            },
          },
          {
            type: 'project',
            project: {
              id: '10000',
            },
          },
        ],
        editPermissions: [
          {
            type: 'user',
            user: {
              accountId: '10109',
            },
          },
          {
            type: 'group',
            group: {
              name: 'jira-administrators2',
            },
          },
          {
            type: 'project',
            project: {
              id: '10003',
            },
          },
        ],
      }
    )

    instances[1] = new InstanceElement(
      'instance1',
      objectType,
      {
        name: 'name1',
        description: 'descrip1',
        jql: 'text ~ "bla"',
        owner: {
          id: '10000',
        },
        sharePermissions: [
          {
            type: 'project',
            project: {
              id: '10011',
            },
          },
        ],
      }
    )

    instances[2] = new InstanceElement(
      'instance1',
      objectType,
      {
        name: 'name1',
        description: 'descrip1',
        jql: 'text ~ "bla"',
        owner: {
          id: '10000',
        },
        editPermissions: [
          {
            type: 'group',
            group: {
              name: 'jira-administrators3',
            },
          },
        ],
      }
    )

    instances[3] = new InstanceElement(
      'instance1',
      objectType,
      {
        name: 'name1',
        description: 'descrip1',
        jql: 'text ~ "bla"',
        owner: {
          id: '10000',
        },
      }
    )

    instances[4] = new InstanceElement(
      'instance1',
      objectWrongType,
      {
        name: 'name1',
        description: 'descrip1',
        jql: 'text ~ "bla"',
        owner: {
          id: '10000',
        },
        sharePermissions: [
          {
            type: 'project',
            project: {
              id: '10001',
            },
          },
        ],
        editPermissions: [
          {
            type: 'group',
            group: {
              name: 'jira-administrators2',
            },
          },
        ],
      }
    )
  })
  describe('pre deploy', () => {
    it('should change edit permissions to share permissions', async () => {
      await filter.preDeploy(
        [toChange({ after: instances[0] }),
          toChange({ after: instances[1] }),
          toChange({ after: instances[2] })]
      )
      expect(instances[0].value.editPermissions).toBeUndefined()
      expect(instances[0].value.sharePermissions.length).toEqual(6)
      verifyEditInstance0(instances[0].value.sharePermissions, 3, true)
      verifyEditProperties(instances[0].value.sharePermissions, 3, 3)

      expect(instances[2].value.editPermissions).toBeUndefined()
      expect(instances[2].value.sharePermissions.length).toEqual(1)
      verifyInstance2(instances[2].value.sharePermissions)
      verifyEditProperties(instances[2].value.sharePermissions, 0, 1)
    })
    it('should add correct properties to share permissions', async () => {
      await filter.preDeploy(
        [toChange({ after: instances[1] }),
          toChange({ after: instances[0] }),
          toChange({ after: instances[2] })]
      )
      expect(instances[0].value.editPermissions).toBeUndefined()
      expect(instances[0].value.sharePermissions.length).toEqual(6)
      verifyShareInstance0(instances[0].value.sharePermissions, 0)
      verifyShareProperties(instances[0].value.sharePermissions, 0, 3)

      expect(instances[1].value.editPermissions).toBeUndefined()
      expect(instances[1].value.sharePermissions.length).toEqual(1)
      verifyInstance1(instances[1].value.sharePermissions)
      verifyShareProperties(instances[1].value.sharePermissions, 0, 1)
    })
  })
  describe('on deploy', () => {
    it('should return edit permissions', async () => {
      await filter.preDeploy(
        [toChange({ after: instances[2] }),
          toChange({ after: instances[1] }),
          toChange({ after: instances[0] })]
      )
      await filter.onDeploy(
        [toChange({ after: instances[2] }),
          toChange({ after: instances[1] }),
          toChange({ after: instances[0] })]
      )
      expect(instances[0].value.editPermissions.length).toEqual(3)
      expect(instances[0].value.sharePermissions.length).toEqual(3)
      verifyEditInstance0(instances[0].value.editPermissions, 0, false)
      verifyNoProperties(instances[0].value.editPermissions)

      expect(instances[2].value.sharePermissions).toBeUndefined()
      expect(instances[2].value.editPermissions.length).toEqual(1)
      verifyInstance2(instances[2].value.editPermissions)
      verifyNoProperties(instances[2].value.editPermissions)
    })

    it('should remove properties from share permissions', async () => {
      await filter.preDeploy(
        [toChange({ after: instances[0] }),
          toChange({ after: instances[1] }),
          toChange({ after: instances[2] })]
      )
      await filter.onDeploy(
        [toChange({ after: instances[0] }),
          toChange({ after: instances[1] }),
          toChange({ after: instances[2] })]
      )
      expect(instances[0].value.editPermissions.length).toEqual(3)
      expect(instances[0].value.sharePermissions.length).toEqual(3)
      verifyShareInstance0(instances[0].value.sharePermissions, 0)
      verifyNoProperties(instances[0].value.sharePermissions)

      expect(instances[1].value.editPermissions).toBeUndefined()
      expect(instances[1].value.sharePermissions.length).toEqual(1)
      verifyInstance1(instances[1].value.sharePermissions)
      verifyNoProperties(instances[1].value.sharePermissions)
    })
  })
  describe('no activation flows', () => {
    it('should not change instances with different type', async () => {
      await filter.preDeploy([toChange({ after: instances[4] })])
      expect(instances[4].value.editPermissions.length).toEqual(1)
      expect(instances[4].value.sharePermissions.length).toEqual(1)
      verifyNoProperties(instances[4].value.sharePermissions)
      verifyNoProperties(instances[4].value.editPermissions)

      await filter.onDeploy([toChange({ after: instances[4] })])
      expect(instances[4].value.editPermissions.length).toEqual(1)
      expect(instances[4].value.sharePermissions.length).toEqual(1)
      verifyNoProperties(instances[4].value.sharePermissions)
      verifyNoProperties(instances[4].value.editPermissions)
    })
    it('should not fail on instances without permissions', async () => {
      await filter.preDeploy([toChange({ after: instances[3] })])
      expect(instances[3].value.editPermissions).toBeUndefined()
      expect(instances[3].value.sharePermissions).toBeUndefined()
      await filter.onDeploy([toChange({ after: instances[3] })])
      expect(instances[3].value.editPermissions).toBeUndefined()
      expect(instances[3].value.sharePermissions).toBeUndefined()
    })
    it('should not change instances on cloud flow', async () => {
      const elemIdGetter = mockFunction<ElemIdGetter>()
        .mockImplementation((adapterName, _serviceIds, name) => new ElemID(adapterName, name))
      const config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      const { client, paginator } = mockClient()
      const cloudFilter = filtersDcDeployFilter(getFilterParams({
        client,
        paginator,
        config,
        getElemIdFunc: elemIdGetter,
      })) as typeof filter
      await cloudFilter.preDeploy(
        [toChange({ after: instances[2] }),
          toChange({ after: instances[1] }),
          toChange({ after: instances[0] })]
      )
      expect(instances[0].value.editPermissions.length).toEqual(3)
      expect(instances[0].value.sharePermissions.length).toEqual(3)
      verifyEditInstance0(instances[0].value.editPermissions, 0, false)
      verifyNoProperties(instances[0].value.editPermissions)
      verifyNoProperties(instances[0].value.sharePermissions)

      expect(instances[2].value.sharePermissions).toBeUndefined()
      expect(instances[2].value.editPermissions.length).toEqual(1)
      verifyInstance2(instances[2].value.editPermissions)
      verifyNoProperties(instances[2].value.editPermissions)

      expect(instances[1].value.editPermissions).toBeUndefined()
      expect(instances[1].value.sharePermissions.length).toEqual(1)
      verifyInstance1(instances[1].value.sharePermissions)
      verifyNoProperties(instances[1].value.sharePermissions)

      await cloudFilter.onDeploy(
        [toChange({ after: instances[2] }),
          toChange({ after: instances[1] }),
          toChange({ after: instances[0] })]
      )
      verifyEditInstance0(instances[0].value.editPermissions, 0, false)
      expect(instances[0].value.editPermissions.length).toEqual(3)
      expect(instances[0].value.sharePermissions.length).toEqual(3)
      verifyNoProperties(instances[0].value.editPermissions)
      verifyNoProperties(instances[0].value.sharePermissions)

      expect(instances[2].value.sharePermissions).toBeUndefined()
      expect(instances[2].value.editPermissions.length).toEqual(1)
      verifyInstance2(instances[2].value.editPermissions)
      verifyNoProperties(instances[2].value.editPermissions)

      expect(instances[1].value.editPermissions).toBeUndefined()
      expect(instances[1].value.sharePermissions.length).toEqual(1)
      verifyInstance1(instances[1].value.sharePermissions)
      verifyNoProperties(instances[1].value.sharePermissions)
    })
  })
})
