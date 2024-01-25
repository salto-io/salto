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

import { ObjectType, ElemID, isInstanceElement, InstanceElement, CORE_ANNOTATIONS, toChange, getChangeData } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { getParent } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import OktaClient from '../../src/client/client'
import { OKTA, USERTYPE_TYPE_NAME, USER_SCHEMA_TYPE_NAME } from '../../src/constants'
import userSchemaFilter from '../../src/filters/user_schema'
import { getFilterParams, mockClient } from '../utils'

describe('userSchemaFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let client: OktaClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
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
      id: 'https://okta.com/api/v1/meta/schemas/user/A123',
      name: 'userSchema123',
      description: 'user schema',
    },
  }
  const userSchemaResponse2 = {
    status: 200,
    data: {
      id: 'https://okta.com/api/v1/meta/schemas/user/B123',
      name: 'userSchema234',
      description: 'user schema',
    },
  }

  const userSchemaResponse3 = {
    status: 200,
    data: {
      id: 'https://okta.com/api/v1/meta/schemas/user/C123',
      name: 'userSchema345',
      description: 'user schema',
    },
  }
  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    filter = userSchemaFilter(getFilterParams({ client })) as typeof filter
  })

  describe('onFetch', () => {
    it('should create UserSchema instances and set UserType as parent', async () => {
      mockConnection.get.mockResolvedValueOnce(userSchemaResponse)
      mockConnection.get.mockResolvedValueOnce(userSchemaResponse2)
      mockConnection.get.mockResolvedValue(userSchemaResponse3)
      const elements = [userSchemaType, userTypeType, userTypeInstanceA, userTypeInstanceB, defaultUserTypeInstance]
      await filter.onFetch(elements)
      const createdInstance = elements
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === USER_SCHEMA_TYPE_NAME)
        .sort()
      expect(createdInstance.length).toEqual(3)
      expect(createdInstance.map(i => i.elemID.getFullName())).toEqual([
        'okta.UserSchema.instance.userSchema123',
        'okta.UserSchema.instance.userSchema234',
        'okta.UserSchema.instance.userSchema345',
      ])
      expect(createdInstance.map(i => i.value)).toEqual([
        { id: 'A123', name: 'userSchema123', description: 'user schema' },
        { id: 'B123', name: 'userSchema234', description: 'user schema' },
        { id: 'C123', name: 'userSchema345', description: 'user schema' },
      ])
      expect(createdInstance.map(i => getParent(i).elemID.getFullName())).toEqual([
        'okta.UserType.instance.test1',
        'okta.UserType.instance.test2',
        'okta.UserType.instance.test3',
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

    it('should do nothing if userSchema type is missing', async () => {
      const elements = [userTypeType, userTypeInstanceA, userTypeInstanceB, defaultUserTypeInstance]
      await filter.onFetch(elements)
      const createdInstance = elements
        .filter(isInstanceElement)
        .filter(inst => inst.elemID.typeName === USER_SCHEMA_TYPE_NAME)
        .sort()
      expect(createdInstance.length).toEqual(0)
    })

    it('should skip UserSchema instance if the response is invalid', async () => {
      mockConnection.get.mockRejectedValue({
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

  describe('preDeploy', () => {
    it('should add get UserSchema id from the parent UserType Instance', async () => {
      const userSchemaInstace = new InstanceElement(
        'schema',
        userSchemaType,
        {
          definitions: {
            value: 'value',
          },
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [
          {
            id: 'userType',
            _links: {
              schema: {
                href: 'https://okta.com/api/v1/meta/schemas/user/555',
              },
            },
          },
        ] },
      )
      const changes = [toChange({ after: userSchemaInstace })]
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.id).toEqual('555')
    })
    it('should do nothing if _link object in the parent UserTypeis not in the expected format', async () => {
      const userSchemaInstace = new InstanceElement(
        'schema',
        userSchemaType,
        {
          definitions: {
            value: 'value',
          },
        },
        undefined,
        { [CORE_ANNOTATIONS.PARENT]: [
          {
            id: 'userType',
            _links: {
              self: {
                value: 'val',
              },
            },
          },
        ] },
      )
      const changes = [toChange({ after: userSchemaInstace })]
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.id).toBeUndefined()
    })
  })
  describe('onDeploy', () => {
    it('should fix UserSchema id after deploy', async () => {
      const userSchemaInstace = new InstanceElement(
        'schema',
        userSchemaType,
        {
          id: 'https://okta.com/api/v1/meta/schemas/user/555',
          definitions: {
            value: 'value',
          },
        },
      )
      const changes = [toChange({ after: userSchemaInstace })]
      await filter.onDeploy(changes)
      expect(getChangeData(changes[0]).value.id).toEqual('555')
    })
  })
})
