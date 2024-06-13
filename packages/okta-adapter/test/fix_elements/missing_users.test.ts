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
import { ElemID, InstanceElement, ObjectType, Values } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import OktaClient from '../../src/client/client'
import * as userUtilsModule from '../../src/user_utils'
import { ACCESS_POLICY_RULE_TYPE_NAME, GROUP_PUSH_TYPE_NAME, GROUP_RULE_TYPE_NAME, OKTA } from '../../src/constants'
import { DEPLOY_CONFIG, FETCH_CONFIG } from '../../src/config'
import { omitMissingUsersHandler } from '../../src/fix_elements/missing_users'
import { DEFAULT_CONFIG, OktaUserConfig } from '../../src/user_config'
import { createFetchQuery } from '../utils'

const createUsersValue = (includeUsers: string[] | undefined, excludeUsers: string[] | undefined): Values => ({
  conditions: {
    people: {
      users: {
        ...(includeUsers ? { include: includeUsers } : {}),
        ...(excludeUsers ? { exclude: excludeUsers } : {}),
      },
    },
  },
})

const createMockUser = (login: string): userUtilsModule.User => ({
  id: 'mockId',
  profile: {
    login,
  },
})

describe('missing_users', () => {
  const fetchQuery = createFetchQuery()
  const EXIST_USER = 'exist.user@salto.io'
  const EXIST_USER2 = 'exist.user+2@salto.io'
  const NOT_EXIST_USER = 'not.exist.user@salto.io'
  const NOT_EXIST_USER2 = 'not.exist.user+2@salto.io'
  // Verify that logic works for ids as well
  const EXIST_USER_ID = 'mockId'
  const ALL_MOCK_USERS = [EXIST_USER, EXIST_USER2, NOT_EXIST_USER, NOT_EXIST_USER2, EXIST_USER_ID]
  const mockClient = {} as OktaClient
  const mockGetUsers = jest
    .spyOn(userUtilsModule, 'getUsers')
    .mockResolvedValue([createMockUser(EXIST_USER), createMockUser(EXIST_USER2)])
  const accessPolicyType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const groupRuleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const pushGroupType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_PUSH_TYPE_NAME) })
  const accessPolicyInstance = new InstanceElement(
    'foo',
    accessPolicyType,
    createUsersValue(ALL_MOCK_USERS, [NOT_EXIST_USER, NOT_EXIST_USER]),
  )
  const groupRuleInstance = new InstanceElement(
    'foo',
    groupRuleType,
    createUsersValue(undefined, [NOT_EXIST_USER, EXIST_USER]),
  )
  const groupPushInstance = new InstanceElement('foo', pushGroupType, { notUsersKnownPath: [NOT_EXIST_USER] })
  const missingUsersHandlerInput = [accessPolicyInstance, groupRuleInstance, groupPushInstance]
  const elementsSource = buildElementsSourceFromElements([])
  beforeEach(() => {
    jest.clearAllMocks()
  })
  describe('when config does not contain "omitMissingUsers" flag', () => {
    const mockConfig = {
      [DEPLOY_CONFIG]: {},
      [FETCH_CONFIG]: {},
    } as OktaUserConfig
    it('should return empty fixElements list and empty errors list', async () => {
      const result = await omitMissingUsersHandler({
        config: mockConfig,
        client: mockClient,
        elementsSource,
        fetchQuery,
      })(missingUsersHandlerInput)
      expect(result.errors).toHaveLength(0)
      expect(result.fixedElements).toHaveLength(0)
      expect(mockGetUsers).not.toHaveBeenCalled()
    })
  })
  describe('when config contains "omitMissingUsers" flag = false', () => {
    const mockConfig = {
      [DEPLOY_CONFIG]: {
        omitMissingUsers: false,
      },
      [FETCH_CONFIG]: {},
    } as OktaUserConfig
    it('should return empty fixElements list and empty errors list', async () => {
      const result = await omitMissingUsersHandler({
        config: mockConfig,
        client: mockClient,
        elementsSource,
        fetchQuery,
      })(missingUsersHandlerInput)
      expect(result.errors).toHaveLength(0)
      expect(result.fixedElements).toHaveLength(0)
      expect(mockGetUsers).not.toHaveBeenCalled()
    })
  })
  describe('when config contains "omitMissingUsers" flag = true', () => {
    const mockConfig = {
      [DEPLOY_CONFIG]: {
        omitMissingUsers: true,
      },
      [FETCH_CONFIG]: {},
    } as OktaUserConfig
    it('should return fixElements list and errors list correctly', async () => {
      const result = await omitMissingUsersHandler({
        config: mockConfig,
        client: mockClient,
        elementsSource,
        fetchQuery,
      })(missingUsersHandlerInput)
      expect(result.errors).toHaveLength(2)
      expect(result.errors).toEqual([
        expect.objectContaining({
          message: '2 users will be omitted',
          severity: 'Warning',
          detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: ${NOT_EXIST_USER}, ${NOT_EXIST_USER2}.
If you continue, they will be omitted. Learn more: ${userUtilsModule.OMIT_MISSING_USERS_CONFIGURATION_LINK}`,
        }),
        expect.objectContaining({
          message: '1 user will be omitted',
          severity: 'Warning',
          detailedMessage: `The following user is referenced by this instance, but do not exist in the target environment: ${NOT_EXIST_USER}.
If you continue, they will be omitted. Learn more: ${userUtilsModule.OMIT_MISSING_USERS_CONFIGURATION_LINK}`,
        }),
      ])
      expect(result.fixedElements).toEqual([
        expect.objectContaining({
          value: createUsersValue([EXIST_USER, EXIST_USER2, EXIST_USER_ID], undefined),
        }),
        expect.objectContaining({
          value: createUsersValue(undefined, [EXIST_USER]),
        }),
      ])
      expect(mockGetUsers.mock.calls[0][1]).toEqual({
        userIds: expect.arrayContaining(ALL_MOCK_USERS),
        property: 'profile.login',
      })
    })
    describe('when convertUsersId is false', () => {
      it('should call getUsers with the correct parameters', async () => {
        await omitMissingUsersHandler({
          config: {
            ...mockConfig,
            [FETCH_CONFIG]: {
              convertUsersIds: false,
            },
          } as OktaUserConfig,
          client: mockClient,
          elementsSource,
          fetchQuery,
        })(missingUsersHandlerInput)
        expect(mockGetUsers.mock.calls[0][1]).toEqual({
          userIds: expect.arrayContaining(ALL_MOCK_USERS),
          property: 'id',
        })
      })
    })
  })
  describe('When User type is included', () => {
    it('should do nothing if User type is included', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        fetch: {
          ...DEFAULT_CONFIG.fetch,
          exclude: [],
        },
      }
      const usersExcludedFetchQuery = createFetchQuery(config)
      const result = await omitMissingUsersHandler({
        config,
        client: mockClient,
        elementsSource,
        fetchQuery: usersExcludedFetchQuery,
      })(missingUsersHandlerInput)
      expect(result.errors).toHaveLength(0)
    })
  })
})
