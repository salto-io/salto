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
import { ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { FilterWith } from '../../src/filter_utils'
import { Paginator } from '../../src/client'
import { queryFilterCreator } from '../../src/filters/query'
import { createMockQuery, ElementQuery } from '../../src/elements/query'

describe('query filter', () => {
  let filter: FilterWith<'onFetch'>
  let instance: InstanceElement
  let fetchQuery: MockInterface<ElementQuery>

  beforeEach(async () => {
    jest.clearAllMocks()
    fetchQuery = createMockQuery()
    filter = queryFilterCreator()({
      client: {} as unknown,
      paginator: undefined as unknown as Paginator,
      fetchQuery,
      config: {
        apiDefinitions: {
          types: {
            role: {
              transformation: {
                serviceUrl: '/roles/{id}',
              },
            },
          },
          typeDefaults: {
            transformation: { idFields: ['id'] },
          },
          supportedTypes: {},
        },
      },
    }) as FilterWith<'onFetch'>

    instance = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('adapter', 'type') }),
    )
  })

  describe('onFetch', () => {
    it('should remove instance if not matched in the query', async () => {
      fetchQuery.isInstanceMatch.mockReturnValue(false)
      const elements = [instance]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(0)
    })

    it('should not remove instance if matched in the query', async () => {
      fetchQuery.isInstanceMatch.mockReturnValue(true)
      const elements = [instance]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(1)
    })
  })
})
