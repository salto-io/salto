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
import { definitions as definitionsUtils, fetch, filterUtils } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import groupsAndUsersFilter, { FALLBACK_DISPLAY_NAME } from '../../src/filters/groups_and_users_filter'
import { DEFAULT_CONFIG, UserConfig } from '../../src/config'
import { Options } from '../../src/definitions/types'
import { ADAPTER_NAME, GROUP_TYPE_NAME, PAGE_TYPE_NAME, SPACE_TYPE_NAME } from '../../src/constants'
import { createDeployDefinitions, createFetchDefinitions } from '../../src/definitions'
import * as getUsersAndGroupsModule from '../../src/get_users'

const mockGetUsersAndGroups = jest.spyOn(getUsersAndGroupsModule, 'getUsersIndex').mockResolvedValue({
  userId1: {
    accountId: 'userId1',
    displayName: 'user1',
  },
  userId2: {
    accountId: 'userId2',
    displayName: 'user2',
  },
})

describe('groupsAndUsersFilter', () => {
  let filter: filterUtils.Filter<filterUtils.FilterResult>
  let elements: InstanceElement[]
  const spaceObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, SPACE_TYPE_NAME) })
  const pageObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, PAGE_TYPE_NAME) })
  const groupObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, GROUP_TYPE_NAME) })
  const otherObjectType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, 'otherType') })
  const generateElements = (): InstanceElement[] => {
    const spaceInst = new InstanceElement('space', spaceObjectType, {
      permissions: [
        {
          type: 'user',
          principalId: 'userId1',
          key: 'key1',
          targetType: 'targetType1',
        },
        {
          type: 'user',
          principalId: 'idNotExists',
          key: 'key1',
          targetType: 'targetType1',
        },
        {
          type: 'group',
          principalId: 'groupId2',
          key: 'key2',
          targetType: 'targetType2',
        },
        {
          type: 'group',
          principalId: 'idNotExists',
          key: 'key2',
          targetType: 'targetType2',
        },
      ],
      authorId: { accountId: 'userId1' },
    })
    const pageInst = new InstanceElement('page', pageObjectType, {
      authorId: { accountId: 'userId1', displayName: 'userId1' },
      ownerId: { accountId: 'userId2', displayName: 'userId2' },
      notUserField: { accountId: 'notUserField', displayName: 'notUserField' },
    })
    const otherInst = new InstanceElement('other', otherObjectType, {
      authorId: { accountId: 'userId1' },
    })
    const group1Inst = new InstanceElement('group1', groupObjectType, {
      name: 'group1',
      id: 'groupId1',
    })
    const group2Inst = new InstanceElement('group2', groupObjectType, {
      name: 'group2',
      id: 'groupId2',
    })
    return [spaceInst, pageInst, otherInst, group1Inst, group2Inst]
  }
  const fetchDef = createFetchDefinitions(DEFAULT_CONFIG)
  const deployDef = createDeployDefinitions()
  const mockDefinitions = {
    fetch: fetchDef,
    deploy: deployDef,
  } as definitionsUtils.ApiDefinitions<Options>
  const mockFilterArgs = {
    config: {} as UserConfig,
    elementSource: buildElementsSourceFromElements([]),
    sharedContext: {},
    fetchQuery: {} as fetch.query.ElementQuery,
    definitions: mockDefinitions,
  }

  describe('fetch', () => {
    beforeEach(async () => {
      jest.clearAllMocks()
      filter = groupsAndUsersFilter(mockFilterArgs)
      elements = generateElements()
      await filter.onFetch?.(elements)
    })
    it('should adjust users and groups references on space instances', () => {
      expect(mockGetUsersAndGroups).toHaveBeenCalledWith(mockDefinitions)
      expect(elements.find(elem => elem.elemID.typeName === SPACE_TYPE_NAME)?.value).toEqual({
        authorId: { accountId: 'userId1', displayName: 'user1' },
        permissions: [
          {
            type: 'user',
            principalId: 'userId1',
            key: 'key1',
            targetType: 'targetType1',
            displayName: 'user1',
          },
          {
            type: 'user',
            principalId: 'idNotExists',
            key: 'key1',
            targetType: 'targetType1',
            displayName: FALLBACK_DISPLAY_NAME,
          },
          {
            type: 'group',
            principalId: 'groupId2',
            key: 'key2',
            targetType: 'targetType2',
            displayName: 'group2',
          },
          {
            type: 'group',
            principalId: 'idNotExists',
            key: 'key2',
            targetType: 'targetType2',
            displayName: FALLBACK_DISPLAY_NAME,
          },
        ],
      })
    })
    it('should adjust users references on page instances', () => {
      expect(elements.find(elem => elem.elemID.typeName === PAGE_TYPE_NAME)?.value).toEqual({
        authorId: { accountId: 'userId1', displayName: 'user1' },
        ownerId: { accountId: 'userId2', displayName: 'user2' },
        notUserField: { accountId: 'notUserField', displayName: 'notUserField' },
      })
    })
    it('should not adjust users and groups references on different types', () => {
      expect(elements.find(elem => elem.elemID.typeName === 'otherType')?.value).toEqual({
        authorId: { accountId: 'userId1' },
      })
    })
  })
})
