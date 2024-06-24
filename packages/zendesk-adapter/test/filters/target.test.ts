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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createFilterCreatorParams } from '../utils'
import { TARGET_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/target'

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

describe('target filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const target = new InstanceElement('test', new ObjectType({ elemID: new ElemID(ZENDESK, TARGET_TYPE_NAME) }), {
    title: 'test',
    method: 'get',
    active: true,
    attribute: 'test-attr',
    username: 'test-username',
    password: 'password',
    target_url: 'http://test.com/test',
  })
  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })
  describe('deploy', () => {
    it('should pass the correct params to deployChange on create - no auth', async () => {
      const id = 2
      const clonedTarget = target.clone()
      delete clonedTarget.value.username
      delete clonedTarget.value.password
      const deployedTarget = clonedTarget.clone()
      deployedTarget.value.id = id
      mockDeployChange.mockImplementation(async () => ({ target: { id } }))
      const res = await filter.deploy([{ action: 'add', data: { after: clonedTarget } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: deployedTarget } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([{ action: 'add', data: { after: clonedTarget } }])
    })

    it('should pass the correct params to deployChange on update - changed auth', async () => {
      const id = 2
      const clonedTargetBefore = target.clone()
      const clonedTargetAfter = target.clone()
      clonedTargetBefore.value.id = id
      clonedTargetAfter.value.id = id
      clonedTargetAfter.value.username = 'username - updated'
      clonedTargetAfter.value.password = 'password - updated'
      const deployedTargetAfter = clonedTargetAfter.clone()
      delete deployedTargetAfter.value.username
      delete deployedTargetAfter.value.password
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedTargetBefore, after: clonedTargetAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedTargetBefore, after: deployedTargetAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedTargetBefore, after: clonedTargetAfter },
        },
      ])
    })
    it('should pass the correct params to deployChange on update - auth was not changed', async () => {
      const id = 2
      const clonedTargetBefore = target.clone()
      const clonedTargetAfter = target.clone()
      clonedTargetBefore.value.id = id
      clonedTargetAfter.value.id = id
      clonedTargetAfter.value.title = 'title - updated'
      const deployedTargetAfter = clonedTargetAfter.clone()
      delete deployedTargetAfter.value.username
      delete deployedTargetAfter.value.password
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedTargetBefore, after: clonedTargetAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedTargetBefore, after: deployedTargetAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedTargetBefore, after: clonedTargetAfter },
        },
      ])
    })

    it('should pass the correct params to deployChange on update - auth was deleted', async () => {
      const id = 2
      const clonedTargetBefore = target.clone()
      const clonedTargetAfter = target.clone()
      clonedTargetBefore.value.id = id
      clonedTargetAfter.value.id = id
      delete clonedTargetAfter.value.username
      delete clonedTargetAfter.value.password
      const deployedTargetAfter = clonedTargetAfter.clone()
      deployedTargetAfter.value.username = null
      deployedTargetAfter.value.password = null
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        { action: 'modify', data: { before: clonedTargetBefore, after: deployedTargetAfter } },
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'modify', data: { before: clonedTargetBefore, after: deployedTargetAfter } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        {
          action: 'modify',
          data: { before: clonedTargetBefore, after: deployedTargetAfter },
        },
      ])
    })

    it('should not handle remove changes', async () => {
      const id = 2
      const clonedTarget = target.clone()
      clonedTarget.value.id = id
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([{ action: 'remove', data: { before: clonedTarget } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(1)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })

    it('should return error if deployChange failed', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('err')
      })
      const clonedTarget = target.clone()
      const deployedTarget = target.clone()
      delete deployedTarget.value.username
      delete deployedTarget.value.password
      const res = await filter.deploy([{ action: 'add', data: { after: clonedTarget } }])
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: { action: 'add', data: { after: deployedTarget } },
        client: expect.anything(),
        endpointDetails: expect.anything(),
        fieldsToIgnore: undefined,
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
