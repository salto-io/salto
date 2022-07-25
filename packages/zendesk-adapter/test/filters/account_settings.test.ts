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
import {
  ObjectType, ElemID, InstanceElement,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { DEFAULT_CONFIG } from '../../src/config'
import ZendeskClient from '../../src/client/client'
import { paginate } from '../../src/client/pagination'
import { ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/account_settings'

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

describe('account settings filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const accountSettings = new InstanceElement(
    ElemID.CONFIG_NAME,
    new ObjectType({ elemID: new ElemID(ZENDESK, 'account_setting') }),
    {
      branding: {
        header_color: '03363E',
        page_background_color: '333333',
        tab_background_color: '7FA239',
        text_color: 'FFFFFF',
      },
      routing: {
        enabled: false,
        autorouting_tag: '',
        max_email_capacity: 1,
        max_messaging_capacity: 1,
      },
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
      fetchQuery: elementUtils.query.createMockQuery(),
    }) as FilterType
  })
  it('should remove autorouting_tag if it is empty', async () => {
    const clonedAfter = accountSettings.clone()
    clonedAfter.value.branding.header_color = 'FFFFFF'
    mockDeployChange.mockImplementation(async () => ({ }))
    const res = await filter.deploy(
      [{ action: 'modify', data: { before: accountSettings, after: clonedAfter } }]
    )
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'modify', data: { before: accountSettings, after: clonedAfter } },
      expect.anything(),
      expect.anything(),
      ['routing.autorouting_tag']
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges)
      .toEqual([
        { action: 'modify', data: { before: accountSettings, after: clonedAfter } },
      ])
  })
  it('should not remove autorouting_tag if it is not empty', async () => {
    const clonedAfter = accountSettings.clone()
    clonedAfter.value.branding.header_color = 'FFFFFF'
    clonedAfter.value.routing.autorouting_tag = 'myTag'
    mockDeployChange.mockImplementation(async () => ({ }))
    const res = await filter.deploy(
      [{ action: 'modify', data: { before: accountSettings, after: clonedAfter } }]
    )
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'modify', data: { before: accountSettings, after: clonedAfter } },
      expect.anything(),
      expect.anything(),
      []
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(0)
    expect(res.deployResult.appliedChanges)
      .toEqual([
        { action: 'modify', data: { before: accountSettings, after: clonedAfter } },
      ])
  })
  it('should return error if there is more than one account settings', async () => {
    const clonedAfter = accountSettings.clone()
    clonedAfter.value.branding.header_color = 'FFFFFF'
    const res = await filter.deploy([
      { action: 'modify', data: { before: accountSettings, after: clonedAfter } },
      { action: 'modify', data: { before: accountSettings, after: clonedAfter } },
    ])
    expect(mockDeployChange).toHaveBeenCalledTimes(0)
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
  it('should return error if deployChange request failed', async () => {
    const clonedAfter = accountSettings.clone()
    clonedAfter.value.branding.header_color = 'FFFFFF'
    mockDeployChange.mockImplementation(async () => { throw new Error('err') })
    const res = await filter.deploy(
      [{ action: 'modify', data: { before: accountSettings, after: clonedAfter } }]
    )
    expect(mockDeployChange).toHaveBeenCalledTimes(1)
    expect(mockDeployChange).toHaveBeenCalledWith(
      { action: 'modify', data: { before: accountSettings, after: clonedAfter } },
      expect.anything(),
      expect.anything(),
      ['routing.autorouting_tag']
    )
    expect(res.leftoverChanges).toHaveLength(0)
    expect(res.deployResult.errors).toHaveLength(1)
    expect(res.deployResult.appliedChanges).toHaveLength(0)
  })
})
