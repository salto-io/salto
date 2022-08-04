/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ListType, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { mockClient } from '../utils'
import userFilter from '../../src/filters/user'
import { Filter } from '../../src/filter'
import { getDefaultConfig } from '../../src/config/config'
import { JIRA } from '../../src/constants'

describe('userFilter', () => {
  let filter: Filter
  let userType: ObjectType
  let type: ObjectType

  beforeEach(async () => {
    const { client, paginator } = mockClient()

    filter = userFilter({
      client,
      paginator,
      config: getDefaultConfig({ isDataCenter: false }),
      elementsSource: buildElementsSourceFromElements([]),
      fetchQuery: elementUtils.query.createMockQuery(),
    })

    userType = new ObjectType({
      elemID: new ElemID(JIRA, 'User'),
    })

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'Type'),
      fields: {
        user: { refType: userType },
        userList: { refType: new ListType(userType) },
      },
    })
  })

  describe('onFetch', () => {
    it('should add the avatarId field if there is an iconUrl field', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
        {
          user: {
            displayName: 'John Doe',
          },
          userList: [{
            displayName: 'John Doe',
          }],
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        user: 'John Doe',
        userList: ['John Doe'],
      })
    })

    it('should do nothing of not a user type', async () => {
      const instance = new InstanceElement(
        'instance',
        type,
        {
          notUser: {
            displayName: 'John Doe',
          },
        }
      )
      await filter.onFetch?.([instance])
      expect(instance.value).toEqual({
        notUser: {
          displayName: 'John Doe',
        },
      })
    })

    it('should replace field type', async () => {
      await filter.onFetch?.([type])
      expect(await type.fields.user.getType()).toBe(BuiltinTypes.STRING)
      expect(await type.fields.userList.getType()).toEqual(new ListType(BuiltinTypes.STRING))
    })
  })
})
