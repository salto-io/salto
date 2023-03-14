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
import {
  ObjectType, ElemID, InstanceElement, toChange,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/view'
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

describe('views filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const view = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK, 'view') }),
    {
      title: 'Test',
      active: true,
      position: 1,
      description: 'description test - 2',
      restriction: {
        type: 'Group',
        ids: [1],
      },
      execution: {
        group_by: 123,
        group_order: 'asc',
        sort_by: 'nice_id',
        sort_order: 'desc',
        group: {
          id: 123,
          title: 'Requester',
          type: 'tagger',
          order: 'asc',
        },
        sort: {
          id: 'ticket_id',
          title: 'ID',
          order: 'desc',
        },
        columns: [
          {
            id: 'subject',
            title: 'Subject',
          },
          {
            id: 'requester',
            title: 'Requester',
          },
          {
            id: 2,
            title: 'zip code with validation',
            type: 'regexp',
          },
        ],
        fields: [
          {
            id: 'subject',
            title: 'Subject',
          },
          {
            id: 'requester',
            title: 'Requester',
          },
        ],
        custom_fields: [
          {
            id: 2,
            title: 'zip code with validation',
            type: 'regexp',
          },
        ],
      },
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
          {
            field: 'custom_status_id',
            operator: 'includes',
            value: [5, 6],
          },
          {
            field: 'custom_fields_1500009152882',
            operator: 'not_present',
          },
        ],
        any: [
          {
            field: 'priority',
            operator: 'is_not',
            value: 'low',
          },
          {
            field: 'custom_fields_1500009152882',
            operator: 'includes',
            value: 'v1',
          },
        ],
      },
    }
  )
  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('preDeploy', () => {
    const clonedView = view.clone()
    beforeEach(async () => {
      const change = toChange({ after: clonedView })
      await filter?.preDeploy([change])
    })

    it('should add any', async () => {
      expect(clonedView.value.any).toEqual([
        { field: 'priority', operator: 'is_not', value: 'low' },
        { field: 'custom_fields_1500009152882', operator: 'includes', value: 'v1' },
      ])
    })
    it('should add all', async () => {
      expect(clonedView.value.all).toEqual([
        { field: 'status', operator: 'is', value: 'open' },
        { field: 'brand_id', operator: 'is', value: '3' },
        { field: 'custom_status_id', operator: 'includes', value: ['5', '6'] },
        { field: 'custom_fields_1500009152882', operator: 'not_present' },
      ])
    })
    it('should add output', async () => {
      expect(clonedView.value.output).toEqual({
        ...clonedView.value.execution,
        group_by: '123',
        columns: ['subject', 'requester', 2],
      })
    })
    it('should keep conditions', async () => {
      expect(clonedView.value.conditions).toBeDefined()
    })
    it('should keep execution', async () => {
      expect(clonedView.value.execution).toBeDefined()
    })
    it('should use empty list for any and columns if they do not exist', async () => {
      const anotherClonedView = view.clone()
      delete anotherClonedView.value.execution.columns
      delete anotherClonedView.value.conditions.any
      const change = toChange({ after: anotherClonedView })
      await filter?.preDeploy([change])
      expect(anotherClonedView.value.output.columns).toBeDefined()
      expect(anotherClonedView.value.output.columns).toHaveLength(0)
      expect(anotherClonedView.value.any).toBeDefined()
      expect(anotherClonedView.value.any).toHaveLength(0)
    })
  })

  describe('onDeploy', () => {
    const clonedView = view.clone()
    beforeEach(async () => {
      clonedView.value.any = view.value.conditions.any
      clonedView.value.all = view.value.conditions.all
      clonedView.value.output = view.value.execution
      const change = toChange({ after: clonedView })
      await filter?.onDeploy([change])
    })

    it('should remove any', async () => {
      expect(clonedView.value.any).toBeUndefined()
    })
    it('should remove all', async () => {
      expect(clonedView.value.all).toBeUndefined()
    })
    it('should remove output', async () => {
      expect(clonedView.value.output).toBeUndefined()
    })
    it('should keep conditions', async () => {
      expect(clonedView.value.conditions).toBeDefined()
    })
    it('should keep execution', async () => {
      expect(clonedView.value.execution).toBeDefined()
    })
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange on create', async () => {
      const id = 2
      const clonedView = view.clone()
      mockDeployChange.mockImplementation(async () => ({ view: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedView } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: clonedView } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['conditions', 'execution'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([{ action: 'add', data: { after: clonedView } }])
    })

    it('should pass the correct params to deployChange on update', async () => {
      const id = 2
      const clonedViewBefore = view.clone()
      const clonedViewAfter = view.clone()
      clonedViewBefore.value.id = id
      clonedViewAfter.value.id = id
      clonedViewAfter.value.description = 'edited'
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter
        .deploy([{ action: 'modify', data: { before: clonedViewBefore, after: clonedViewAfter } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedViewBefore, after: clonedViewAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['conditions', 'execution'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          {
            action: 'modify',
            data: { before: clonedViewBefore, after: clonedViewAfter },
          },
        ])
    })

    it('should pass the correct params to deployChange on remove', async () => {
      const id = 2
      const clonedView = view.clone()
      clonedView.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedView } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const res = await filter.deploy([{ action: 'add', data: { after: view } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: view } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: ['conditions', 'execution'],
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
