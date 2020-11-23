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
import MarketoAdapter from '../src/adapter'
import MarketoClient from '../src/client/client'
import mockAdapter from './adapter'
import { customObjectsMockArray, leadsMockArray } from './common/mock_elements'


describe('Marketo Adapter Operations', () => {
  let adapter: MarketoAdapter
  let client: MarketoClient

  beforeEach(() => {
    ({ client, adapter } = mockAdapter())
  })

  describe('Fetch operation', () => {
    beforeEach(async () => {
      client.describe = jest.fn()
        .mockReturnValueOnce(leadsMockArray)
        .mockReturnValue(customObjectsMockArray)

      client.getAllInstances = jest.fn()
        .mockReturnValue(customObjectsMockArray)
    })

    it('should fetch basic', async () => {
      const { elements } = await adapter.fetch()
      expect(elements).toHaveLength(14)
    })
  })
})
