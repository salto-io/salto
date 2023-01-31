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
import { InstanceElement } from '@salto-io/adapter-api'
import { client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../utils'
import accountInfoFilter from '../../src/filters/account_info'
import { Filter } from '../../src/filter'

describe('accountInfoFilter', () => {
  let filter: Filter
  let connection: MockInterface<clientUtils.APIConnection>
  let elements: InstanceElement[]

  beforeEach(async () => {
    const { client, connection: conn } = mockClient()
    connection = conn
    filter = accountInfoFilter(getFilterParams({ client }))
    elements = []
  })

  describe('onFetch', () => {
    it('should populate license successfully', async () => {
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: { applications: [
          {
            id: 'jira-software',
            plan: 'FREE',
          },
          {
            id: 'other-app',
            plan: 'PAID',
          },
        ] },
      })
      await filter.onFetch?.(elements)
      expect(elements.length).toEqual(4)
      expect(elements[0].elemID.getFullName()).toEqual('jira.License')
      expect(elements[1].elemID.getFullName()).toEqual('jira.LicensedApplication')
      expect(elements[2].elemID.getFullName()).toEqual('jira.AccountInfo')
      expect(elements[3].value).toEqual({ license: { applications: [
        { id: 'jira-software', plan: 'FREE' },
        { id: 'other-app', plan: 'PAID' },
      ] } })
    })
    it('should do nothing for a wrong license answer', async () => {
      connection.get.mockResolvedValueOnce({
        status: 200,
        data: { other: [
          {
            id: 'jira-software',
            plan: 'FREE',
          },
        ] },
      })
      await filter.onFetch?.(elements)
      expect(elements.length).toEqual(0)
    })
    it('should do nothing on data center', async () => {
      const { client, connection: dcConnection } = mockClient(true)
      const dcFilter = accountInfoFilter(getFilterParams({ client }))
      dcFilter.onFetch?.(elements)
      expect(dcConnection.get).not.toHaveBeenCalled()
      expect(elements.length).toEqual(0)
    })
  })
})
