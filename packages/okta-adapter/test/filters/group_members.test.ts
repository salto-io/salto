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
import {
  ObjectType,
  ElemID,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  CORE_ANNOTATIONS,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { GROUP_MEMBERSHIP_TYPE_NAME, GROUP_TYPE_NAME, OKTA } from '../../src/constants'
import groupMembersFilter from '../../src/filters/group_members'
import { getFilterParams } from '../utils'

describe('groupMembersFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const config = { ...DEFAULT_CONFIG }
  config[FETCH_CONFIG].includeGroupMemberships = true
  const groupInstance = new InstanceElement('groupTest', groupType, {
    id: '123',
    type: 'OKTA_GROUP',
    profile: { name: 'test' },
  })

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  describe('onFetch', () => {
    it('should do nothing when includeGroupMemberships config flag is disabled', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [{ id: '111', profile: { login: 'a@a.com' } }]
      })
      const elements = [groupType, groupInstance]
      filter = groupMembersFilter(getFilterParams({ paginator: mockPaginator })) as FilterType
      expect(elements.length).toEqual(2)
      expect(elements.filter(e => e.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME).length).toEqual(0)
      expect(mockPaginator).toHaveBeenCalledTimes(0)
    })
    it('should create GroupMemberships type when flag is enabled', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [{ id: '111', profile: { login: 'a@a.com' } }]
      })
      const elements = [groupType, groupInstance]
      filter = groupMembersFilter(getFilterParams({ paginator: mockPaginator, config })) as FilterType
      await filter.onFetch(elements)
      const groupMembersType = elements
        .filter(isObjectType)
        .find(type => type.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME)
      expect(groupMembersType?.elemID.getFullName()).toEqual('okta.GroupMembership')
    })
    it('should create GroupMemberships instances when flag is enabled', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [
          { id: '111', profile: { login: 'a@a.com' } },
          { id: '222', profile: { login: 'b@a.com' } },
          { id: '333', profile: { login: 'c@a.com' } },
          { id: '555', profile: { login: 'd@a.com' } },
        ]
      })
      const elements = [groupType, groupInstance]
      filter = groupMembersFilter(getFilterParams({ paginator: mockPaginator, config })) as FilterType
      await filter.onFetch(elements)
      const groupMembersInstance = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME)
      expect(groupMembersInstance?.value).toEqual({
        members: ['a@a.com', 'b@a.com', 'c@a.com', 'd@a.com'],
      })
      expect(groupMembersInstance?.annotations[CORE_ANNOTATIONS.PARENT]).toEqual([
        new ReferenceExpression(groupInstance.elemID, groupInstance),
      ])
      expect(mockPaginator).toHaveBeenNthCalledWith(
        1,
        {
          url: '/api/v1/groups/123/users',
          paginationField: 'after',
        },
        expect.anything(),
      )
    })
    it('should not create GroupMemberships instance when there are no members', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield []
      })
      const elements = [groupType, groupInstance]
      filter = groupMembersFilter(getFilterParams({ paginator: mockPaginator, config })) as FilterType
      await filter.onFetch(elements)
      const groupMembersInstances = elements
        .filter(isInstanceElement)
        .find(inst => inst.elemID.typeName === GROUP_MEMBERSHIP_TYPE_NAME)
      // group members instance was not created because groupInstance has no members
      expect(groupMembersInstances).toEqual(undefined)
      expect(mockPaginator).toHaveBeenCalledTimes(1)
      expect(mockPaginator).toHaveBeenNthCalledWith(
        1,
        {
          url: '/api/v1/groups/123/users',
          paginationField: 'after',
        },
        expect.anything(),
      )
    })
  })
})
