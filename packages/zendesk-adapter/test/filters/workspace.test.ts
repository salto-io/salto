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
import { ObjectType, ElemID, InstanceElement, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/workspace'
import { createFilterCreatorParams } from '../utils'

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
  type FilterType = filterUtils.FilterWith<'deploy' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const workspace = new InstanceElement('Test', new ObjectType({ elemID: new ElemID(ZENDESK, 'workspace') }), {
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
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })
  describe('preDeploy', () => {
    beforeEach(async () => {
      const change = toChange({ after: workspace })
      await filter?.preDeploy([change])
    })

    it('should add macros', async () => {
      expect(workspace.value.macros).toEqual([1])
    })

    it('should keep selected_macros', async () => {
      expect(workspace.value.selected_macros).toHaveLength(1)
    })
  })

  describe('onDeploy', () => {
    const clonedWorkspace = workspace.clone()
    beforeEach(async () => {
      clonedWorkspace.value.macros = [1]
      const change = toChange({ after: clonedWorkspace })
      await filter?.onDeploy([change])
    })

    it('should remove macros', async () => {
      expect(clonedWorkspace.value.macros).toBeUndefined()
    })

    it('should have selected_macros', async () => {
      expect(clonedWorkspace.value.selected_macros).toBeDefined()
    })
  })

  describe('deploy', () => {
    beforeEach(async () => {
      workspace.value.macros = [1]
      const change = toChange({ after: workspace })
      await filter?.onDeploy([change])
    })

    it('should pass the correct params to deployChange on create', async () => {
      const id = 2
      mockDeployChange.mockImplementation(async () => ({ workspace: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: workspace } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: workspace } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['selected_macros'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: workspace } }])
    })

    it('should pass the correct params to deployChange on update', async () => {
      const id = 2
      const clonedWSBefore = workspace.clone()
      const clonedWSAfter = workspace.clone()
      clonedWSBefore.value.id = id
      clonedWSAfter.value.id = id
      clonedWSAfter.value.description = 'edited'
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'modify', data: { before: clonedWSBefore, after: clonedWSAfter } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedWSBefore, after: clonedWSAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['selected_macros'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedWSBefore, after: clonedWSAfter },
        },
      ])
    })

    it('should pass the correct params to deployChange on remove', async () => {
      const id = 2
      const clonedWorkspace = workspace.clone()
      clonedWorkspace.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedWorkspace } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: workspace } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: workspace } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['selected_macros'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
  it('should return error when client returns with status 200 and errors in an array', async () => {
    const clonedWSAfter = workspace.clone()
    delete clonedWSAfter.value.title

    mockDeployChange.mockImplementation(async () => ({ errors: ['zendesk error'], status: 200 }))

    const res = await filter.deploy([{ action: 'add', data: { after: clonedWSAfter } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedWSAfter } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['selected_macros'],
    })

    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return error when client returns with status 200 and errors as string', async () => {
    const clonedWSAfter = workspace.clone()
    delete clonedWSAfter.value.title

    mockDeployChange.mockImplementation(async () => ({ errors: 'zendesk error', status: 200 }))

    const res = await filter.deploy([{ action: 'add', data: { after: clonedWSAfter } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith({
      change: { action: 'add', data: { after: clonedWSAfter } },
      client: expect.anything(),
      endpointDetails: expect.anything(),
      fieldsToIgnore: ['selected_macros'],
    })

    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
})
