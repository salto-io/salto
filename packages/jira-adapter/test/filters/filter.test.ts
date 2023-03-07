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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { createEmptyType, getFilterParams } from '../utils'
import filtersFilter from '../../src/filters/filter'
import { Filter } from '../../src/filter'

describe('filtersFilter', () => {
  let filter: Filter

  beforeEach(async () => {
    filter = filtersFilter(getFilterParams())
  })
  it('should replace user field on pre deploy', async () => {
    const instance = new InstanceElement(
      'instance',
      createEmptyType('Filter'),
      {
        editPermissions: [
          {
            type: 'user',
            user: {
              id: 'noOne',
            },
          },
          {
            type: 'user',
            user: {
              id: 'noOne2',
            },
          },
        ],
      }
    )
    await filter.preDeploy?.([toChange({ after: instance })])
    expect(instance.value).toEqual({
      editPermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne2',
            },
          },
        },
      ],
    })
  })
  it('should return user field after deploy', async () => {
    const instance = new InstanceElement(
      'instance',
      createEmptyType('Filter'),
      {
        editPermissions: [
          {
            type: 'user',
            user: {
              accountId: {
                id: 'noOne',
              },
            },
          },
          {
            type: 'user',
            user: {
              accountId: {
                id: 'noOne2',
              },
            },
          },
        ],
      }
    )
    await filter.onDeploy?.([toChange({ after: instance })])
    expect(instance.value).toEqual({
      editPermissions: [
        {
          type: 'user',
          user: {
            id: 'noOne',
          },
        },
        {
          type: 'user',
          user: {
            id: 'noOne2',
          },
        },
      ],
    })
  })

  it('should do nothing if not a filter type', async () => {
    const instance = new InstanceElement(
      'instance',
      createEmptyType('Other'),
      {
        editPermissions: [
          {
            type: 'user',
            user: {
              id: 'noOne',
            },
          },
          {
            type: 'user',
            user: {
              id: 'noOne2',
            },
          },
        ],
      }
    )
    await filter.preDeploy?.([toChange({ after: instance })])
    expect(instance.value).toEqual({
      editPermissions: [
        {
          type: 'user',
          user: {
            id: 'noOne',
          },
        },
        {
          type: 'user',
          user: {
            id: 'noOne2',
          },
        },
      ],
    })
    const instance2 = new InstanceElement(
      'instance2',
      createEmptyType('Other'),
      {
        editPermissions: [
          {
            type: 'user',
            user: {
              accountId: {
                id: 'noOne',
              },
            },
          },
          {
            type: 'user',
            user: {
              accountId: {
                id: 'noOne2',
              },
            },
          },
        ],
      }
    )
    await filter.onDeploy?.([toChange({ after: instance2 })])
    expect(instance2.value).toEqual({
      editPermissions: [
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne',
            },
          },
        },
        {
          type: 'user',
          user: {
            accountId: {
              id: 'noOne2',
            },
          },
        },
      ],
    })
  })
})
