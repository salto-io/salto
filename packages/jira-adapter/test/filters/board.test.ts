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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../src/constants'
import boardFilter from '../../src/filters/board'
import { mockClient, getDefaultAdapterConfig } from '../utils'

describe('boardFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let instance: InstanceElement
  let type: ObjectType
  beforeEach(async () => {
    const { client, paginator } = mockClient()
    filter = boardFilter({
      client,
      paginator,
      config: await getDefaultAdapterConfig(),
    }) as typeof filter

    type = new ObjectType({ elemID: new ElemID(JIRA, 'Board') })

    instance = new InstanceElement(
      'instance',
      type,
      {
        config: {
          filter: {
            id: '1',
          },
        },
      }
    )
  })

  it('should add filterId', async () => {
    await filter.onFetch([instance])
    expect(instance.value).toEqual({
      config: {
      },
      filterId: '1',
    })
  })

  it('should add nothing for partial instance', async () => {
    instance.value = {}
    await filter.onFetch([instance])
    expect(instance.value).toEqual({})
  })
})
