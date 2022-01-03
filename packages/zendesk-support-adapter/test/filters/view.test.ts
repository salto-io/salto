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
import filterCreator from '../../src/filters/view'

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
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const view = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'view') }),
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
        group_by: 'requester',
        group_order: 'asc',
        sort_by: 'nice_id',
        sort_order: 'desc',
        group: {
          id: 'requester',
          title: 'Requester',
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
  const viewToDeploy = new InstanceElement(
    'Test',
    new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'view') }),
    {
      title: 'Test',
      active: true,
      position: 1,
      description: 'description test - 2',
      restriction: {
        type: 'Group',
        ids: [1],
      },
      output: {
        group_by: 'requester',
        group_order: 'asc',
        sort_by: 'nice_id',
        sort_order: 'desc',
        group: {
          id: 'requester',
          title: 'Requester',
          order: 'asc',
        },
        sort: {
          id: 'ticket_id',
          title: 'ID',
          order: 'desc',
        },
        columns: ['subject', 'requester', 2],
      },
      all: [
        {
          field: 'status',
          operator: 'is',
          value: 'open',
        },
        {
          field: 'brand_id',
          operator: 'is',
          value: '3',
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
    const clonedView = view.clone()
    const clonedViewToDeploy = viewToDeploy.clone()
    mockDeployChange.mockImplementation(async () => ({ view: { id } }))
    const res = await filter.deploy([{ action: 'add', data: { after: clonedView } }])
    // The view filter mutates the change after the deploy change and add id
    clonedViewToDeploy.value.id = id
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedViewToDeploy } },
      expect.anything(),
      expect.anything()
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'add', data: { after: clonedViewToDeploy } }])
  })
  it('should pass the correct params to deployChange on update', async () => {
    const id = 2
    const clonedViewBefore = view.clone()
    const clonedViewAfter = view.clone()
    const clonedViewToDeployBefore = viewToDeploy.clone()
    const clonedViewToDeployAfter = viewToDeploy.clone()
    clonedViewAfter.value.description = 'edited'
    clonedViewToDeployAfter.value.description = 'edited';
    [clonedViewBefore, clonedViewAfter, clonedViewToDeployBefore, clonedViewToDeployAfter]
      .forEach(inst => {
        inst.value.id = id
      })
    mockDeployChange.mockImplementation(async () => ({}))
    const res = await filter
      .deploy([{ action: 'modify', data: { before: clonedViewBefore, after: clonedViewAfter } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'modify', data: { before: clonedViewToDeployBefore, after: clonedViewToDeployAfter } },
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
          data: { before: clonedViewToDeployBefore, after: clonedViewToDeployAfter },
        },
      ])
  })
  it('should pass the correct params to deployChange on remove', async () => {
    const id = 2
    const clonedView = view.clone()
    clonedView.value.id = id
    mockDeployChange.mockImplementation(async () => ({}))
    const res = await filter.deploy([{ action: 'remove', data: { before: clonedView } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'remove', data: { before: clonedView } },
      expect.anything(),
      expect.anything()
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'remove', data: { before: clonedView } }])
  })
  it('should throw exception if the view we about to deploy is invalied', async () => {
    const invalidView = new InstanceElement(
      'Test',
      new ObjectType({ elemID: new ElemID(ZENDESK_SUPPORT, 'view') }),
      {
        title: 'Test',
        active: true,
        position: 1,
        description: 'description test - 2',
      },
    )
    const res = await filter.deploy([{ action: 'add', data: { after: invalidView } }])
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should use empty list for any and columns if they do not exist', async () => {
    const id = 2
    mockDeployChange.mockImplementation(async () => ({ view: { id } }))
    const clonedView = view.clone()
    delete clonedView.value.execution.columns
    delete clonedView.value.conditions.any
    const clonedViewToDeploy = viewToDeploy.clone()
    clonedViewToDeploy.value.id = id
    clonedViewToDeploy.value.output.columns = []
    clonedViewToDeploy.value.any = []
    const res = await filter.deploy([{ action: 'add', data: { after: clonedView } }])
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'add', data: { after: clonedViewToDeploy } },
      expect.anything(),
      expect.anything()
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges).toHaveLength(1)
    expect(res.deployResult.appliedChanges)
      .toEqual([{ action: 'add', data: { after: clonedViewToDeploy } }])
  })
})
