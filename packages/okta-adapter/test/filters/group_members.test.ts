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
import _ from 'lodash'
import {
  ObjectType,
  ElemID,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  toChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { MockInterface, mockFunction } from '@salto-io/test-utils'
import { DEFAULT_CONFIG, FETCH_CONFIG } from '../../src/config'
import { GROUP_MEMBERSHIP_TYPE_NAME, GROUP_TYPE_NAME, OKTA } from '../../src/constants'
import groupMembersFilter from '../../src/filters/group_members'
import { getFilterParams, mockClient } from '../utils'
import OktaClient from '../../src/client/client'

describe('groupMembersFilter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'deploy'>
  let filter: FilterType
  const groupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_TYPE_NAME) })
  const config = { ...DEFAULT_CONFIG }
  config[FETCH_CONFIG].includeGroupMemberships = true
  const groupInstance = new InstanceElement('groupTest', groupType, {
    id: '123',
    type: 'OKTA_GROUP',
    profile: { name: 'test' },
  })
  const anotherGroup = new InstanceElement('anotherGroup', groupType, { id: '234', type: 'OKTA_GROUP' })

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
  describe('deploy', () => {
    let mockConnection: MockInterface<clientUtils.APIConnection>
    let client: OktaClient
    const groupMembersType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_MEMBERSHIP_TYPE_NAME) })
    const groupMembersInstance = new InstanceElement(
      'groupTest',
      groupMembersType,
      { members: ['a', 'c'] },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(groupInstance.elemID, groupInstance)] },
    )
    beforeEach(() => {
      jest.clearAllMocks()
      const { client: cli, connection } = mockClient()
      mockConnection = connection
      client = cli
      const includeGroupMembershipsEnabled = { ...DEFAULT_CONFIG }
      includeGroupMembershipsEnabled[FETCH_CONFIG].includeGroupMemberships = true
      filter = groupMembersFilter(getFilterParams({ client, config: includeGroupMembershipsEnabled })) as typeof filter
    })
    it('should return error when includeGroupMemberships config flag is disabled', async () => {
      const includeGroupMembershipsDisabled = _.cloneDeep(DEFAULT_CONFIG)
      includeGroupMembershipsDisabled[FETCH_CONFIG].includeGroupMemberships = false
      filter = groupMembersFilter(getFilterParams({ config: includeGroupMembershipsDisabled })) as FilterType
      const { deployResult, leftoverChanges } = await filter.deploy([toChange({ after: groupMembersInstance })])
      expect(leftoverChanges).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(1)
      expect(deployResult.errors[0].message).toEqual(
        'Group membership is disabled. To apply this change, change fetch.includeGroupMemberships flag to “true” in your Okta environment configuration.',
      )
    })
    it('should deploy group membership instance', async () => {
      const modification = toChange({
        before: new InstanceElement('groupTestB', groupMembersType, { members: ['a', 'b'] }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: [anotherGroup.value], // references are already resolved
        }),
        after: new InstanceElement('groupTestB', groupMembersType, { members: ['b', 'c'] }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: [anotherGroup.value], // references are already resolved
        }),
      })
      const addition = toChange({
        after: new InstanceElement(
          'groupTest',
          groupMembersType,
          { members: ['a', 'c'] },
          undefined,
          { [CORE_ANNOTATIONS.PARENT]: [groupInstance.value] }, // references are already resolved
        ),
      })
      const { deployResult, leftoverChanges } = await filter.deploy([
        modification, // modification change
        addition, // addition change
      ])

      expect(mockConnection.put).toHaveBeenCalledTimes(3)
      expect(mockConnection.put).toHaveBeenCalledWith('/api/v1/groups/234/users/c', undefined, undefined)
      expect(mockConnection.put).toHaveBeenCalledWith('/api/v1/groups/123/users/a', undefined, undefined)
      expect(mockConnection.put).toHaveBeenCalledWith('/api/v1/groups/123/users/c', undefined, undefined)
      expect(mockConnection.delete).toHaveBeenCalledTimes(1)
      expect(mockConnection.delete).toHaveBeenCalledWith('/api/v1/groups/234/users/a', expect.anything())

      expect(leftoverChanges).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(2)
      expect(deployResult.appliedChanges.map(change => (getChangeData(change) as InstanceElement).value)).toEqual([
        { members: ['b', 'c'] },
        { members: ['a', 'c'] },
      ])
      expect(deployResult.errors).toHaveLength(0)
    })
    it('should update change with the actual results in case some assignments failed', async () => {
      const modification = toChange({
        before: new InstanceElement('groupTestB', groupMembersType, { members: ['a', 'b', 'c'] }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: [groupInstance.value], // references are already resolved
        }),
        after: new InstanceElement('groupTestB', groupMembersType, { members: ['c', 'd', 'e'] }, undefined, {
          [CORE_ANNOTATIONS.PARENT]: [groupInstance.value], // references are already resolved
        }),
      })
      mockConnection.put.mockImplementation(async url => {
        if (url === '/api/v1/groups/123/users/e') {
          throw new Error('Not found')
        }
        return { status: 200, data: [] }
      })
      mockConnection.delete.mockImplementation(async url => {
        if (url === '/api/v1/groups/123/users/b') {
          throw new Error('Not found')
        }
        return { status: 200, data: [] }
      })

      const { deployResult, leftoverChanges } = await filter.deploy([modification])
      expect(leftoverChanges).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(1)
      expect((getChangeData(deployResult.appliedChanges[0]) as InstanceElement).value).toEqual({
        members: ['c', 'd', 'b'],
      })
      expect(deployResult.errors).toHaveLength(0)
    })
    it('should return error if parent group id is missing', async () => {
      const groupNoId = new InstanceElement('noID', groupType, {})
      const groupMembers = new InstanceElement('A', groupMembersType, { members: ['a'] }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [groupNoId.value], // references are already resolved
      })
      const { deployResult, leftoverChanges } = await filter.deploy([toChange({ after: groupMembers })])
      expect(leftoverChanges).toHaveLength(0)
      expect(deployResult.appliedChanges).toHaveLength(0)
      expect(deployResult.errors).toHaveLength(1)
      expect(deployResult.errors[0].message).toEqual('Failed to get group ID')
    })
  })
})
