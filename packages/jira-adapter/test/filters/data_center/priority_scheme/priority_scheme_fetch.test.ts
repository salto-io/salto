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
import { Element, Value, InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils, elements as elementUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../../utils'
import prioritySchemeFetchFilter from '../../../../src/filters/data_center/priority_scheme/priority_scheme_fetch'
import JiraClient from '../../../../src/client/client'
import { JIRA } from '../../../../src/constants'


describe('prioritySchemeFetchFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let client: JiraClient
  let paginator: clientUtils.Paginator
  let connection: MockInterface<clientUtils.APIConnection>
  let fetchQuery: MockInterface<elementUtils.query.ElementQuery>
  let prioritySchemeResponse: Value

  beforeEach(async () => {
    const { client: cli, paginator: cliPaginator, connection: conn } = mockClient(true)
    client = cli
    paginator = cliPaginator
    connection = conn

    fetchQuery = elementUtils.query.createMockQuery()

    filter = prioritySchemeFetchFilter(getFilterParams({
      client,
      paginator,
      fetchQuery,
    })) as filterUtils.FilterWith<'onFetch'>

    prioritySchemeResponse = {
      status: 200,
      data: {
        schemes: [
          {
            id: '1',
            name: 'name',
            description: 'desc',
            optionIds: [
              '1',
              '2',
            ],
            defaultOptionId: '2',
            defaultScheme: false,
          },
        ],
      },
    }

    connection.get.mockResolvedValue(prioritySchemeResponse)
  })

  describe('onFetch', () => {
    it('should fetch priority schemes from the service', async () => {
      prioritySchemeResponse.data.schemes.push({
        id: '2',
        name: 'name2',
        description: 'desc2',
        optionIds: [
          '1',
          '2',
        ],
        defaultOptionId: '2',
        defaultScheme: false,
      })
      const elements: Element[] = []
      await filter.onFetch(elements)

      expect(elements).toHaveLength(3)

      const [instance1, instance2, type] = elements

      expect((instance1 as InstanceElement).value).toEqual({
        id: '1',
        name: 'name',
        description: 'desc',
        optionIds: ['1', '2'],
        defaultOptionId: '2',
      })

      expect((instance2 as InstanceElement).value).toEqual({
        id: '2',
        name: 'name2',
        description: 'desc2',
        optionIds: ['1', '2'],
        defaultOptionId: '2',
      })

      expect(instance1.elemID.getFullName()).toEqual('jira.PriorityScheme.instance.name')
      expect(instance2.elemID.getFullName()).toEqual('jira.PriorityScheme.instance.name2')
      expect(type.elemID.getFullName()).toEqual('jira.PriorityScheme')
      expect((type as ObjectType).fields.id).toBeDefined()
      expect((type as ObjectType).fields.name).toBeDefined()
      expect((type as ObjectType).fields.description).toBeDefined()
      expect((type as ObjectType).fields.optionIds).toBeDefined()
      expect((type as ObjectType).fields.defaultOptionId).toBeDefined()

      expect(connection.get).toHaveBeenCalledWith(
        '/rest/api/2/priorityschemes',
        undefined
      )
    })

    it('should not fetch priority schemes if running in jira cloud', async () => {
      const { client: cli, paginator: cliPaginator, connection: conn } = mockClient(false)
      client = cli
      paginator = cliPaginator
      connection = conn

      filter = prioritySchemeFetchFilter(getFilterParams({
        client,
        paginator,
        fetchQuery,
      })) as filterUtils.FilterWith<'onFetch'>

      const elements: Element[] = []
      await filter.onFetch(elements)

      expect(elements).toHaveLength(0)

      expect(connection.get).not.toHaveBeenCalled()
    })

    it('should not fetch priority schemes if priority schemes were excluded', async () => {
      fetchQuery.isTypeMatch.mockReturnValue(false)
      const elements: Element[] = []
      await filter.onFetch(elements)

      expect(elements).toHaveLength(0)

      expect(connection.get).not.toHaveBeenCalled()
    })

    it('should use elemIdGetter', async () => {
      filter = prioritySchemeFetchFilter(getFilterParams({
        client,
        paginator,
        getElemIdFunc: () => new ElemID(JIRA, 'someName'),
      })) as filterUtils.FilterWith<'onFetch'>

      const elements: Element[] = []
      await filter.onFetch(elements)

      const instance = elements[0]
      expect(instance.elemID.getFullName()).toEqual('jira.PriorityScheme.instance.someName')
    })

    it('should return default when it is true', async () => {
      prioritySchemeResponse.data.schemes[0].defaultScheme = true

      const elements: Element[] = []
      await filter.onFetch(elements)

      expect(elements).toHaveLength(2)

      const [instance] = elements

      expect((instance as InstanceElement).value).toEqual({
        id: '1',
        name: 'name',
        description: 'desc',
        optionIds: ['1', '2'],
        defaultOptionId: '2',
        defaultScheme: true,
      })
    })
  })
})
