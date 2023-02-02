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
import { elements as elementsUtils, filterUtils } from '@salto-io/adapter-components'
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_statuses'
import { createFilterCreatorParams } from '../utils'
import {
  CUSTOM_STATUS_TYPE_NAME,
  DEFAULT_CUSTOM_STATUSES_TYPE_NAME, HOLD_CATEGORY, OPEN_CATEGORY,
  PENDING_CATEGORY, SOLVED_CATEGORY,
  ZENDESK,
} from '../../src/constants'
import ZendeskClient from '../../src/client/client'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'

const { RECORDS_PATH } = elementsUtils

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


describe('custom statuses filter', () => {
  let client: ZendeskClient
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'deploy'>
  let filter: FilterType
  let mockPut: jest.SpyInstance

  const customStatusType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_STATUS_TYPE_NAME) })

  const createStatus = (category: string, isDefault: boolean, id: number): InstanceElement => new InstanceElement(
    `${category} ${isDefault ? 'default' : ''}`,
    customStatusType,
    {
      id,
      status_category: category,
      agent_label: `${category} ${isDefault ? 'default' : ''}`,
      raw_agent_label: `${category} ${isDefault ? 'default' : ''}`,
      end_user_label: `${category} ${isDefault ? 'default' : ''}`,
      raw_end_user_label: `${category} ${isDefault ? 'default' : ''}`,
      description: `${category} ${isDefault ? 'default' : ''}`,
      raw_description: `${category} ${isDefault ? 'default' : ''}`,
      end_user_description: `${category} ${isDefault ? 'default' : ''}`,
      raw_end_user_description: `${category} ${isDefault ? 'default' : ''}`,
      active: true,
      default: isDefault,
    }
  )

  const pendingDefault = createStatus('pending', true, 1)
  const pending = createStatus('pending', false, 2)
  const solvedDefault = createStatus('solved', true, 3)
  const solved = createStatus('solved', false, 4)
  const openDefault = createStatus('open', true, 5)
  const open = createStatus('open', false, 6)
  const holdDefault = createStatus('hold', true, 7)
  const hold = createStatus('hold', false, 8)

  const defaultCustomStatusesType = new ObjectType(
    {
      elemID: new ElemID(ZENDESK, DEFAULT_CUSTOM_STATUSES_TYPE_NAME),
      fields: {
        [PENDING_CATEGORY]: { refType: BuiltinTypes.NUMBER },
        [SOLVED_CATEGORY]: { refType: BuiltinTypes.NUMBER },
        [OPEN_CATEGORY]: { refType: BuiltinTypes.NUMBER },
        [HOLD_CATEGORY]: { refType: BuiltinTypes.NUMBER },
      },
      isSettings: true,
      path: [ZENDESK, elementsUtils.TYPES_PATH, DEFAULT_CUSTOM_STATUSES_TYPE_NAME],
    }
  )
  const defaultCustomStatusesInstance = new InstanceElement(
    ElemID.CONFIG_NAME,
    defaultCustomStatusesType,
    {
      [PENDING_CATEGORY]: pendingDefault.value.id,
      [SOLVED_CATEGORY]: solvedDefault.value.id,
      [OPEN_CATEGORY]: openDefault.value.id,
      [HOLD_CATEGORY]: holdDefault.value.id,
    },
    [ZENDESK, RECORDS_PATH, DEFAULT_CUSTOM_STATUSES_TYPE_NAME, defaultCustomStatusesType.elemID.name],
  )

  beforeEach(async () => {
    jest.clearAllMocks()
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    filter = filterCreator(createFilterCreatorParams({
      client,
      config: {
        ...DEFAULT_CONFIG,
        [FETCH_CONFIG]: {
          include: [{
            type: '.*',
          }],
          exclude: [],
          guide: {
            brands: ['.*'],
          },
        },
      },
    })) as FilterType
  })

  describe('onFetch', () => {
    it('should create default_custom_statuses instance and object', async () => {
      const elements = [
        pendingDefault,
        pending,
        solvedDefault,
        solved,
        openDefault,
        open,
        holdDefault,
        hold,
      ]
      await filter.onFetch(elements)
      expect(elements).toEqual([
        pendingDefault,
        pending,
        solvedDefault,
        solved,
        openDefault,
        open,
        holdDefault,
        hold,
        defaultCustomStatusesType,
        defaultCustomStatusesInstance,
      ])
    })
    it('should do nothing if default does not exist', async () => {
      const elements = [
        pending,
        solved,
        open,
        hold,
      ]
      await filter.onFetch(elements)
      expect(elements).toEqual([
        pending,
        solved,
        open,
        hold,
      ])
    })
  })
  describe('preDeploy', () => {
    it('should sync raw and non-raw fields on addition', async () => {
      const clonedInstance = pending.clone()
      clonedInstance.value.raw_agent_label = 'changed'
      clonedInstance.value.raw_end_user_label = 'changed'
      clonedInstance.value.raw_description = 'changed'
      clonedInstance.value.raw_end_user_description = 'changed'
      const instanceAfterPreDeploy = clonedInstance.clone()
      instanceAfterPreDeploy.value.agent_label = 'changed'
      instanceAfterPreDeploy.value.end_user_label = 'changed'
      instanceAfterPreDeploy.value.description = 'changed'
      instanceAfterPreDeploy.value.end_user_description = 'changed'
      await filter.preDeploy([toChange({ after: clonedInstance })])
      expect(clonedInstance).toEqual(instanceAfterPreDeploy)
    })
    it('should sync raw and non-raw fields on modification', async () => {
      const clonedInstance = pending.clone()
      clonedInstance.value.raw_agent_label = 'changed'
      clonedInstance.value.raw_end_user_label = 'changed'
      clonedInstance.value.raw_description = 'changed'
      clonedInstance.value.raw_end_user_description = 'changed'
      const instanceAfterPreDeploy = clonedInstance.clone()
      instanceAfterPreDeploy.value.agent_label = 'changed'
      instanceAfterPreDeploy.value.end_user_label = 'changed'
      instanceAfterPreDeploy.value.description = 'changed'
      instanceAfterPreDeploy.value.end_user_description = 'changed'
      await filter.preDeploy([toChange({ before: clonedInstance, after: clonedInstance })])
      expect(clonedInstance).toEqual(instanceAfterPreDeploy)
    })
  })
  describe('deploy', () => {
    it('should deploy addition of custom_status', async () => {
      mockDeployChange.mockImplementation(async () => ({ custom_statuses: solved.value }))
      const res = await filter.deploy([{ action: 'add', data: { after: solved } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: solved } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges)
        .toEqual([{ action: 'add', data: { after: solved } }])
    })
    it('should deploy modification of custom_status and modification of default', async () => {
      mockPut = jest.spyOn(client, 'put')
      // For article_attachment UT
      mockPut.mockImplementation(params => {
        if ([
          '/api/v2/custom_status/default',
        ].includes(params.url)) {
          return {
            status: 200,
          }
        }
        throw new Error('Err')
      })
      const clonedDefault = defaultCustomStatusesInstance.clone()
      clonedDefault.value.solved = 4
      mockDeployChange.mockImplementation(async () => ({ custom_statuses: solved.value }))
      const res = await filter.deploy([
        { action: 'modify', data: { before: solved, after: solved } },
        { action: 'modify', data: { before: defaultCustomStatusesInstance, after: clonedDefault } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: solved, after: solved } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: '/api/v2/custom_status/default',
        data: { ids: '1,4,5,7' },
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges)
        .toEqual([
          { action: 'modify', data: { before: solved, after: solved } },
          { action: 'modify', data: { before: defaultCustomStatusesInstance, after: clonedDefault } },
        ])
    })
    it('should not deploy default when there is an http error', async () => {
      mockPut = jest.spyOn(client, 'put')
      // For article_attachment UT
      mockPut.mockImplementation(() => { throw new Error('Err') })
      const clonedDefault = defaultCustomStatusesInstance.clone()
      clonedDefault.value.solved = 4
      const res = await filter.deploy([
        { action: 'modify', data: { before: defaultCustomStatusesInstance, after: clonedDefault } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(mockPut).toHaveBeenCalledTimes(1)
      expect(mockPut).toHaveBeenCalledWith({
        url: '/api/v2/custom_status/default',
        data: { ids: '1,4,5,7' },
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
