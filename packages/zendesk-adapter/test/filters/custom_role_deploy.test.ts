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
import { createFilterCreatorParams } from '../utils'
import { CUSTOM_ROLE_TYPE_NAME, ZENDESK } from '../../src/constants'
import filterCreator from '../../src/filters/custom_role_deploy'

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

describe('customRoleDeploy filter', () => {
  type FilterType = filterUtils.FilterWith<'deploy'>
  let filter: FilterType
  const customRoleType = new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_ROLE_TYPE_NAME) })
  const customRoleBeforeInstnace1 = new InstanceElement('customRoleBefore1', customRoleType, {
    id: 1337,
    name: 'role1',
    description: 'role1 description',
    configuration: {
      twitter_search_access: false,
      forum_access_restricted_content: false,
      end_user_list_access: 'full',
      ticket_access: 'within-groups',
      ticket_comment_access: 'none',
    },
  })
  const customRoleAfterInstnace1 = new InstanceElement('customRoleBefore1', customRoleType, {
    id: 1337,
    name: 'role1 after',
    description: 'role1 description after',
    configuration: {
      twitter_search_access: true,
      forum_access_restricted_content: false,
      end_user_list_access: 'full',
      ticket_access: 'all',
      ticket_comment_access: 'none',
    },
  })

  beforeEach(async () => {
    jest.clearAllMocks()
    filter = filterCreator(createFilterCreatorParams({})) as FilterType
  })

  describe('deploy', () => {
    it('should pass the correct params to deployChange for modification change', async () => {
      mockDeployChange.mockImplementation(async () => ({
        [CUSTOM_ROLE_TYPE_NAME]: {
          ...customRoleAfterInstnace1.value,
        },
      }))
      const res = await filter.deploy([
        toChange({ before: customRoleBeforeInstnace1, after: customRoleAfterInstnace1 }),
      ])
      const newDataInstance = new InstanceElement('customRoleBefore1', customRoleType, {
        id: 1337,
        name: 'role1 after',
        description: 'role1 description after',
        configuration: {
          twitter_search_access: true,
          ticket_access: 'all',
        },
      })
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: toChange({ before: customRoleBeforeInstnace1, after: newDataInstance }),
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toEqual([
        toChange({ before: customRoleBeforeInstnace1, after: customRoleAfterInstnace1 }),
      ])
    })
    it('should do nothing for addition and removal changes', async () => {
      mockDeployChange.mockImplementation(async () => ({}))
      const res = await filter.deploy([
        toChange({ before: customRoleBeforeInstnace1 }),
        toChange({ after: customRoleAfterInstnace1 }),
      ])
      expect(mockDeployChange).toHaveBeenCalledTimes(0)
      expect(res.leftoverChanges).toHaveLength(2)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
    it('should return an error iF the deploy did not work', async () => {
      mockDeployChange.mockImplementation(async () => {
        throw new Error('ERR')
      })
      const res = await filter.deploy([
        toChange({ before: customRoleBeforeInstnace1, after: customRoleAfterInstnace1 }),
      ])
      const newDataInstance = new InstanceElement('customRoleBefore1', customRoleType, {
        id: 1337,
        name: 'role1 after',
        description: 'role1 description after',
        configuration: {
          twitter_search_access: true,
          ticket_access: 'all',
        },
      })
      expect(mockDeployChange).toHaveBeenCalledTimes(1)
      expect(mockDeployChange).toHaveBeenCalledWith({
        change: toChange({ before: customRoleBeforeInstnace1, after: newDataInstance }),
        client: expect.anything(),
        endpointDetails: expect.anything(),
      })
      expect(res.leftoverChanges).toHaveLength(0)
      expect(res.deployResult.errors).toHaveLength(1)
      expect(res.deployResult.appliedChanges).toHaveLength(0)
    })
  })
})
