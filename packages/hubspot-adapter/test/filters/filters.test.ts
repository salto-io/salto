/*
*                      Copyright 2020 Salto Labs Ltd.
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
import HubspotAdapter from '../../src/adapter'
import { FilterWith } from '../../src/filter'
import mockAdapter from '../mock'
import { HubspotMetadata } from '../../src/client/types'
import HubspotClient from '../../src/client/client'

describe('HubspotAdapter filters', () => {
  let adapter: HubspotAdapter
  let client: HubspotClient

  describe('when filter methods are implemented', () => {
    let filter: FilterWith<'onFetch'>

    beforeEach(() => {
      filter = {
        onFetch: jest.fn().mockImplementationOnce(elements => elements),
      }

      const mocks = mockAdapter(
        { adapterParams: { filtersCreators: [() => filter] } }
      )
      adapter = mocks.adapter
      client = mocks.client
      const mockGetAllInstances = jest.fn().mockImplementation(
        (_type: string): Promise<HubspotMetadata[]> => (
            [] as unknown as Promise<HubspotMetadata[]>)
      )
      client.getAllInstances = mockGetAllInstances
    })

    it('should call onFetch filters upon fetch', async () => {
      await adapter.fetch()
      const { mock } = filter.onFetch as jest.Mock
      expect(mock.calls.length).toEqual(1)
    })
  })
})
