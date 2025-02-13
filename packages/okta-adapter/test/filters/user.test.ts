/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  isInstanceElement,
  toChange,
  getChangeData,
  ModificationChange,
} from '@salto-io/adapter-api'
import { client as clientUtils, filterUtils } from '@salto-io/adapter-components'
import { mockFunction } from '@salto-io/test-utils'
import { FETCH_CONFIG } from '../../src/config'
import { DEFAULT_CONFIG } from '../../src/user_config'
import {
  ACCESS_POLICY_RULE_TYPE_NAME,
  GROUP_RULE_TYPE_NAME,
  OKTA,
  GROUP_MEMBERSHIP_TYPE_NAME,
} from '../../src/constants'
import userFilter from '../../src/filters/user'
import { getFilterParams } from '../utils'
import { getUsers } from '../../src/user_utils'

describe('user filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let filter: FilterType
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const accessPolicyRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const endUserSupportType = new ObjectType({ elemID: new ElemID(OKTA, 'EndUserSupport') })
  const groupMembersType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_MEMBERSHIP_TYPE_NAME) })
  const groupRuleInstance = new InstanceElement('groupRuleTest', groupRuleType, {
    name: 'test',
    conditions: {
      people: { users: { exclude: ['111', '222'] } },
    },
  })
  const accessRuleInstance = new InstanceElement('accessPolicyRuleTest', accessPolicyRuleType, {
    name: 'test',
    conditions: {
      people: { users: { exclude: ['222'], include: ['111', '333', '555'] } },
    },
  })
  const endUserInstance = new InstanceElement('settings', endUserSupportType, { technicalContactId: '222' })
  const afterFetchInstances = [
    new InstanceElement('group', groupRuleType, {
      name: 'test',
      conditions: { people: { users: { exclude: ['a@a.com', 'b@a.com'] } } },
    }),
    new InstanceElement('accessPolicy', accessPolicyRuleType, {
      name: 'test',
      conditions: {
        people: { users: { exclude: ['b@a.com'], include: ['a@a.com', 'c@a.com', 'd@a.com'] } },
      },
    }),
    new InstanceElement('settings', endUserSupportType, { technicalContactId: 'b@a.com' }),
  ]

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  describe('onFetch', () => {
    it('should change user ids to user login', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [
          { id: '111', profile: { login: 'a@a.com' } },
          { id: '222', profile: { login: 'b@a.com' } },
          { id: '333', profile: { login: 'c@a.com' } },
          { id: '555', profile: { login: 'd@a.com' } },
        ]
      })
      filter = userFilter(
        getFilterParams({ paginator: mockPaginator, usersPromise: getUsers(mockPaginator), config: DEFAULT_CONFIG }),
      ) as FilterType
      const elements = [
        groupRuleType,
        groupRuleInstance,
        accessPolicyRuleType,
        accessRuleInstance,
        endUserSupportType,
        endUserInstance,
      ].map(e => e.clone())
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const groupRule = instances.find(e => e.elemID.typeName === GROUP_RULE_TYPE_NAME)
      expect(groupRule?.value).toEqual({
        name: 'test',
        conditions: {
          people: { users: { exclude: ['a@a.com', 'b@a.com'] } },
        },
      })
      const accessRule = instances.find(e => e.elemID.typeName === ACCESS_POLICY_RULE_TYPE_NAME)
      expect(accessRule?.value).toEqual({
        name: 'test',
        conditions: {
          people: {
            users: {
              exclude: ['b@a.com'],
              include: ['a@a.com', 'c@a.com', 'd@a.com'],
            },
          },
        },
      })
      const endUserS = instances.find(e => e.elemID.typeName === 'EndUserSupport')
      expect(endUserS?.value).toEqual({
        technicalContactId: 'b@a.com',
      })
      expect(mockPaginator).toHaveBeenNthCalledWith(
        1,
        {
          url: '/api/v1/users',
          headers: { 'Content-Type': 'application/json; okta-response=omitCredentials,omitCredentialsLinks' },
          paginationField: 'after',
        },
        expect.anything(),
      )
    })
    it('should not replace user ids that were missing from response', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [
          { id: '111', profile: { login: 'a@a.com' } },
          { id: '222', profile: { login: 'b@a.com' } },
        ]
      })
      filter = userFilter(
        getFilterParams({
          paginator: mockPaginator,
          usersPromise: getUsers(mockPaginator),
          config: DEFAULT_CONFIG,
        }),
      ) as FilterType
      const elements = [accessRuleInstance.clone(), accessPolicyRuleType.clone()]
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const accessPolicy = instances.find(e => e.elemID.name === 'accessPolicyRuleTest')
      expect(accessPolicy?.value).toEqual({
        name: 'test',
        conditions: {
          people: {
            users: {
              exclude: ['b@a.com'],
              include: ['a@a.com', '333', '555'],
            },
          },
        },
      })
    })
    it('should not replace anything if convertUsersIds config option is disabled', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [
          { id: '111', profile: { login: 'a@a.com' } },
          { id: '222', profile: { login: 'b@a.com' } },
        ]
      })
      filter = userFilter(
        getFilterParams({
          paginator: mockPaginator,
          config: {
            ...DEFAULT_CONFIG,
            [FETCH_CONFIG]: {
              ...DEFAULT_CONFIG.fetch,
              convertUsersIds: false,
            },
          },
          usersPromise: getUsers(mockPaginator),
        }),
      ) as FilterType
      const elements = [groupRuleInstance.clone(), groupRuleType.clone()]
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const groupRule = instances.find(e => e.elemID.typeName === GROUP_RULE_TYPE_NAME)
      expect(groupRule?.value).toEqual({
        name: 'test',
        conditions: {
          people: { users: { exclude: ['111', '222'] } },
        },
      })
    })
    it('should not replace anything if User type is included in fetch config', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementation(async function* get() {
        yield [
          { id: '111', profile: { login: 'a@a.com' } },
          { id: '222', profile: { login: 'b@a.com' } },
        ]
      })
      filter = userFilter(
        getFilterParams({
          paginator: mockPaginator,
          config: {
            ...DEFAULT_CONFIG,
            [FETCH_CONFIG]: {
              ...DEFAULT_CONFIG.fetch,
              exclude: [],
            },
          },
          usersPromise: getUsers(mockPaginator),
        }),
      ) as FilterType
      const elements = [groupRuleInstance.clone(), groupRuleType.clone()]
      await filter.onFetch(elements)
      const instances = elements.filter(isInstanceElement)
      const groupRule = instances.find(e => e.elemID.typeName === GROUP_RULE_TYPE_NAME)
      expect(groupRule?.value).toEqual({
        name: 'test',
        conditions: {
          people: { users: { exclude: ['111', '222'] } },
        },
      })
    })
  })
  describe('preDeploy', () => {
    it('should change the logins to user ids', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementationOnce(async function* get() {
        yield [
          { id: '111', profile: { login: 'a@a.com' } },
          { id: '222', profile: { login: 'b@a.com' } },
          { id: '333', profile: { login: 'c@a.com' } },
          { id: '555', profile: { login: 'd@a.com' } },
        ]
      })
      filter = userFilter(getFilterParams({ paginator: mockPaginator, config: DEFAULT_CONFIG })) as FilterType
      const changes = afterFetchInstances.map(instance => toChange({ after: instance.clone() }))
      await filter.preDeploy(changes)
      const changedInstances = changes.map(getChangeData)
      const groupRule = changedInstances.find(inst => inst.elemID.name === 'group')
      expect(groupRule?.value).toEqual({
        name: 'test',
        conditions: { people: { users: { exclude: ['111', '222'] } } },
      })
      const accessRule = changedInstances.find(inst => inst.elemID.name === 'accessPolicy')
      expect(accessRule?.value).toEqual({
        name: 'test',
        conditions: {
          people: { users: { exclude: ['222'], include: ['111', '333', '555'] } },
        },
      })
      const endUserS = changedInstances.find(e => e.elemID.typeName === 'EndUserSupport')
      expect(endUserS?.value).toEqual({
        technicalContactId: '222',
      })
    })
    it('should work on the before value of modification changes', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementationOnce(async function* get() {
        yield [
          { id: '111', profile: { login: 'a@a.com' } },
          { id: '222', profile: { login: 'b@a.com' } },
          { id: '333', profile: { login: 'c@a.com' } },
          { id: '555', profile: { login: 'd@a.com' } },
        ]
      })
      const before = new InstanceElement('modified', groupMembersType, { members: ['a@a.com', 'b@a.com'] })
      const after = new InstanceElement('modified', groupMembersType, { members: ['b@a.com', 'c@a.com'] })
      filter = userFilter(getFilterParams({ paginator: mockPaginator, config: DEFAULT_CONFIG })) as FilterType
      const change = toChange({ before, after }) as ModificationChange<InstanceElement>
      await filter.preDeploy([change])
      const beforeMembers = change.data.before.value.members
      expect(beforeMembers).toEqual(['111', '222'])
      const afterMembers = change.data.after.value.members
      expect(afterMembers).toEqual(['222', '333'])
    })
  })
  describe('onDeploy', () => {
    it('should change the user ids to login based on mapping created preDeploy', async () => {
      const mockPaginator = mockFunction<clientUtils.Paginator>().mockImplementationOnce(async function* get() {
        yield [
          { id: '111', profile: { login: 'a@a.com' } },
          { id: '222', profile: { login: 'b@a.com' } },
          { id: '333', profile: { login: 'c@a.com' } },
          { id: '555', profile: { login: 'd@a.com' } },
        ]
      })
      filter = userFilter(getFilterParams({ paginator: mockPaginator, config: DEFAULT_CONFIG })) as FilterType
      const changes = afterFetchInstances.map(instance => toChange({ after: instance.clone() }))
      // preDeploy sets the mappings
      await filter.preDeploy(changes)
      await filter.onDeploy(changes)
      const changedInstances = changes.map(getChangeData)
      const groupRule = changedInstances.find(inst => inst.elemID.name === 'group')
      expect(groupRule?.value).toEqual({
        name: 'test',
        conditions: { people: { users: { exclude: ['a@a.com', 'b@a.com'] } } },
      })
      const accessRule = changedInstances.find(inst => inst.elemID.name === 'accessPolicy')
      expect(accessRule?.value).toEqual({
        name: 'test',
        conditions: {
          people: { users: { exclude: ['b@a.com'], include: ['a@a.com', 'c@a.com', 'd@a.com'] } },
        },
      })
    })
  })
})
