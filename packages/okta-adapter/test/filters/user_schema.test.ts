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

import { ObjectType, ElemID, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import OktaClient from '../../src/client/client'
import { OKTA, USERTYPE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../../src/constants'
import fetchUserSchemas from '../../src/filters/user_schema'
import { getFilterParams } from '../utils'

describe('fetchUserSchemaInstancesFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let client: OktaClient
  let mockGet: jest.SpyInstance
  const userSchemaType = new ObjectType({ elemID: new ElemID(OKTA, USER_SCHEMA_TYPE_NAME) })
  const userTypeType = new ObjectType({ elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME) })
  const userTypeInstanceA = new InstanceElement(
    'test1',
    userTypeType,
    {
      id: 123,
      name: 'A',
      _links: {
        additionalProperties: {
          schema: {
            href: 'https://okta.com/api/v1/meta/schemas/user/A123',
          },
        },
      },
      default: false,
    },
  )
  const userTypeInstanceB = new InstanceElement(
    'test2',
    userTypeType,
    {
      id: 234,
      name: 'B',
      _links: {
        additionalProperties: {
          schema: {
            href: 'https://okta.com/api/v1/meta/schemas/user/B123',
          },
        },
      },
      default: false,
    },
  )
  const defaultUserTypeInstance = new InstanceElement(
    'test3',
    userTypeType,
    {
      id: 345,
      name: 'C',
      _links: {
        additionalProperties: {
          schema: {
            href: 'https://okta.com/api/v1/meta/schemas/user/C123',
          },
        },
      },
      default: true,
    },
  )

  const userSchemaResponse = {
    status: 200,
    data: {
      id: 'A123',
      name: 'userSchema123',
      description: 'user schema',
    },
  }
  const userSchemaResponse2 = {
    status: 200,
    data: {
      id: 'B123',
      name: 'userSchema234',
      description: 'user schema',
    },
  }
  beforeEach(() => {
    jest.clearAllMocks()
    client = new OktaClient({
      credentials: { baseUrl: 'https://okta.com/', token: 'token' },
    })
    mockGet = jest.spyOn(client, 'getSinglePage')
    filter = fetchUserSchemas(getFilterParams({ client })) as typeof filter
  })

  it('should create userSchema instances', async () => {
    mockGet.mockResolvedValueOnce(userSchemaResponse)
    mockGet.mockResolvedValueOnce(userSchemaResponse2)
    const elements = [userSchemaType, userTypeType, userTypeInstanceA, userTypeInstanceB, defaultUserTypeInstance]
    await filter.onFetch(elements)
    const createdInstance = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .sort()
    expect(createdInstance.length).toEqual(2)
    expect(createdInstance.map(i => i.elemID.getFullName())).toEqual([
      'okta.UserSchema.instance.userSchema123',
      'okta.UserSchema.instance.userSchema234',
    ])
    expect(createdInstance.map(i => i.value)).toEqual([
      { id: 'A123', name: 'userSchema123', description: 'user schema' },
      { id: 'B123', name: 'userSchema234', description: 'user schema' },
    ])
    const userTypeInstances = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === USERTYPE_TYPE_NAME)
      .sort()
    expect(userTypeInstances.length).toEqual(3)
    expect(userTypeInstances.map(i => i.elemID.getFullName())).toEqual([
      'okta.UserType.instance.test1',
      'okta.UserType.instance.test2',
      'okta.UserType.instance.test3',
    ])
  })
  it('should skip userType instance if the matching userSchema id was not found', async () => {
    mockGet.mockResolvedValue(userSchemaResponse)
    const invalidUserTypeInst = new InstanceElement(
      'test',
      userTypeType,
      {
        id: 456,
        name: 'D',
        // incorrect path to href
        _links: {
          schema: {
            href: 'https://okta.com/api/v1/meta/schemas/user/B123',
          },
        },
        default: false,
      },
    )
    const elements = [userSchemaType, userTypeType, userTypeInstanceA, invalidUserTypeInst, defaultUserTypeInstance]
    await filter.onFetch(elements)
    const createdInstance = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .sort()
    expect(createdInstance.length).toEqual(1)
    expect(createdInstance[0].elemID.getFullName()).toEqual('okta.UserSchema.instance.userSchema123')
  })
  it('should do nothing if userSchema type is missing', async () => {
    const elements = [userTypeType, userTypeInstanceA, userTypeInstanceB, defaultUserTypeInstance]
    await filter.onFetch(elements)
    const createdInstance = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .sort()
    expect(createdInstance.length).toEqual(0)
  })

  it('should do nothing if there are no UserType instances except for the default user type', async () => {
    const elements = [userSchemaType, userTypeType, defaultUserTypeInstance]
    await filter.onFetch(elements)
    const createdInstance = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .sort()
    expect(createdInstance.length).toEqual(0)
  })

  it('should skip UserSchema instance if the response is invalid', async () => {
    mockGet.mockRejectedValue({
      response: { status: 404, data: {} },
    })
    const elements = [userSchemaType, userTypeType, userTypeInstanceA, defaultUserTypeInstance]
    await filter.onFetch(elements)
    const createdInstance = elements
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === USER_SCHEMA_TYPE_NAME)
      .sort()
    expect(createdInstance.length).toEqual(0)
  })
})
