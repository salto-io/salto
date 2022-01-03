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
import {
  ObjectType, ElemID, InstanceElement,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZENDESK_SUPPORT } from '../../src/constants'
import filterCreator from '../../src/filters/workspace'

const mockDeployChange = jest.fn()
jest.mock('@salto-io/adapter-components', () => {
  const actual = jest.requireActual('@salto-io/adapter-components')
  return {
    ...actual,
    deployment: {
      ...actual.deployment,
      deployChange: jest.fn((...args) => mockDeployChange(...args)),
    },
  }
})

describe('workspace filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const workspace = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'workspace') }),
    {
      title: 'Test',
      activated: true,
      macro_ids: [1],
      position: 1,
      description: 'description test - 2',
      ticket_form_id: 2,
      apps: [{ id: 3, expand: true, position: 1 }],
      conditions: {
        all: [
          {
            field: 'status',
            operator: 'is',
            value: 'open',
          },
          {
            field: 'brand_id',
            operator: 'is',
            value: 3,
          },
        ],
        any: [
          {
            field: 'priority',
            operator: 'is_not',
            value: 'low',
          },
        ],
      },
      selected_macros: [{ id: 1, title: 'macro title', active: true, usage_7d: 0 }],
    }
  )
  const workspaceToDeploy = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'workspace') }),
    {
      title: 'Test',
      activated: true,
      macro_ids: [1],
      position: 1,
      description: 'description test - 2',
      ticket_form_id: 2,
      apps: [{ id: 3, expand: true, position: 1 }],
      conditions: {
        all: [
          {
            field: 'status',
            operator: 'is',
            value: 'open',
          },
          {
            field: 'brand_id',
            operator: 'is',
            value: 3,
          },
        ],
        any: [
          {
            field: 'priority',
            operator: 'is_not',
            value: 'low',
          },
        ],
      },
      macros: [1],
    }
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator({
      client,
      paginator: clientUtils.createPaginator({
        client,
        paginationFuncCreator: paginate,
      }),
      config: DEFAULT_CONFIG,
    }) as FilterType
  })

  it('should pass the correct params to deployChange on create', async () => {
    const id = 2
    const clonedWorkspace = workspace.clone()
    const clonedWorkspaceToDeploy = workspaceToDeploy.clone()
    mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
    const res = await filter.deploy([{ action: 'add', data: { after: clonedWorkspace } }])
    // The workspace filter mutates the change after the deploy change and add id
    clonedWorkspaceToDeploy.value.id = id
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedWorkspaceToDeploy } },
      expect.anything(),
      expect.anything()
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'add', data: { after: clonedWorkspaceToDeploy } }])
  })
  it('should pass the correct params to deployChange on update', async () => {
    const id = 2
    const clonedWSBefore = workspace.clone()
    const clonedWSAfter = workspace.clone()
    const clonedWSToDeployBefore = workspaceToDeploy.clone()
    const clonedWSToDeployAfter = workspaceToDeploy.clone()
    clonedWSAfter.value.description = 'edited'
    clonedWSToDeployAfter.value.description = 'edited';
    [clonedWSBefore, clonedWSAfter, clonedWSToDeployBefore, clonedWSToDeployAfter]
      .forEach(inst => {
        inst.value.id = id
      })
    mockDeployChange.mockImplementation(async () => ({}))
    const res = await filter
      .deploy([{ action: 'modify', data: { before: clonedWSBefore, after: clonedWSAfter } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'modify', data: { before: clonedWSToDeployBefore, after: clonedWSToDeployAfter } },
      expect.anything(),
      expect.anything()
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([
        {
          action: 'modify',
          data: { before: clonedWSToDeployBefore, after: clonedWSToDeployAfter },
        },
      ])
  })
  it('should pass the correct params to deployChange on remove', async () => {
    const id = 2
    const clonedWorkspace = workspace.clone()
    clonedWorkspace.value.id = id
    mockDeployChange.mockImplementation(async () => ({}))
    const res = await filter.deploy([{ action: 'remove', data: { before: clonedWorkspace } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'remove', data: { before: clonedWorkspace } },
      expect.anything(),
      expect.anything()
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'remove', data: { before: clonedWorkspace } }])
  })
  it('should use empty list for any and columns if they do not exist', async () => {
    const id = 2
    mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
    const clonedWorkspace = workspace.clone()
    delete clonedWorkspace.value.selected_macros
    const clonedWorkspaceToDeploy = workspaceToDeploy.clone()
    clonedWorkspaceToDeploy.value.id = id
    clonedWorkspaceToDeploy.value.macros = []
    const res = await filter.deploy([{ action: 'add', data: { after: clonedWorkspace } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedWorkspaceToDeploy } },
      expect.anything(),
      expect.anything()
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'add', data: { after: clonedWorkspaceToDeploy } }])
  })
  it('should return error if deployChange failed', async () => {
    const id = 2
    mockDeployChange.mockImplementation(async () => {
      throw new Error('err')
    })
    const clonedWorkspace = workspace.clone()
    clonedWorkspace.value.id = id
    const res = await filter.deploy([{ action: 'remove', data: { before: clonedWorkspace } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'remove', data: { before: clonedWorkspace } },
      expect.anything(),
      expect.anything()
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
})
