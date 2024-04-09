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

import { ObjectType, ElemID, InstanceElement, toChange, getChangeData, BuiltinTypes } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import OktaClient from '../../src/client/client'
import { OKTA, USERTYPE_TYPE_NAME } from '../../src/constants'
import userTypeFilter from '../../src/filters/user_type'
import { createDefinitions, getFilterParams, mockClient } from '../utils'

describe('userTypeFilter', () => {
  let filter: filterUtils.FilterWith<'deploy'>
  let client: OktaClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
  const userTypeType = new ObjectType({
    elemID: new ElemID(OKTA, USERTYPE_TYPE_NAME),
    fields: {
      id: { refType: BuiltinTypes.SERVICE_ID },
    },
  })
  const userTypeInstanceA = new InstanceElement('test1', userTypeType, { name: 'A', default: false })
  const userTypeInstanceB = new InstanceElement('test2', userTypeType, { name: 'B', default: false })
  const userTypeInstanceC = new InstanceElement('test3', userTypeType, { name: 'C', default: false })

  beforeEach(() => {
    jest.clearAllMocks()
    const { client: cli, connection } = mockClient()
    mockConnection = connection
    client = cli
    const definitions = createDefinitions({ client })
    filter = userTypeFilter(getFilterParams({ definitions })) as typeof filter
  })

  describe('deploy', () => {
    it('should add _links object to the created UserType instance', async () => {
      mockConnection.post
        .mockResolvedValueOnce({
          status: 200,
          data: {
            id: '123',
            name: 'A',
            _links: {
              schema: { href: 'https://okta.com/api/v1/meta/schemas/user/555' },
              self: { href: 'https://okta.com/api/v1/meta/types/user/123' },
            },
          },
        })
        .mockResolvedValueOnce({
          status: 200,
          data: {
            id: '234',
            name: 'B',
            _links: {
              schema: { href: 'https://okta.com/api/v1/meta/schemas/user/666' },
              self: { href: 'https://okta.com/api/v1/meta/types/user/234' },
            },
          },
        })
      const changes = [toChange({ after: userTypeInstanceA }), toChange({ after: userTypeInstanceB })]
      const res = await filter.deploy(changes)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(2)
      expect(res.deployResult.appliedChanges.map(change => (getChangeData(change) as InstanceElement).value)).toEqual([
        {
          id: '123',
          name: 'A',
          default: false,
          _links: {
            schema: { href: 'https://okta.com/api/v1/meta/schemas/user/555' },
            self: { href: 'https://okta.com/api/v1/meta/types/user/123' },
          },
        },
        {
          id: '234',
          name: 'B',
          default: false,
          _links: {
            schema: { href: 'https://okta.com/api/v1/meta/schemas/user/666' },
            self: { href: 'https://okta.com/api/v1/meta/types/user/234' },
          },
        },
      ])
    })
    it('should should do nothing if _links object is missing from response', async () => {
      mockConnection.post.mockResolvedValue({
        status: 200,
        data: {
          id: '345',
          name: 'C',
        },
      })
      const changes = [toChange({ after: userTypeInstanceC })]
      const res = await filter.deploy(changes)
      expect(res.deployResult.errors).toHaveLength(0)
      expect(res.deployResult.appliedChanges).toHaveLength(1)
      expect((getChangeData(res.deployResult.appliedChanges[0]) as InstanceElement).value).toEqual({
        id: '345',
        name: 'C',
        default: false,
      })
    })
  })
})
