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
import { ObjectType, ElemID, toChange } from '@salto-io/adapter-api'
import SalesforceAdapter from '../../src/adapter'
import { FilterWith, FilterCreator } from '../../src/filter'
import { API_NAME } from '../../src/constants'
import mockAdapter from '../adapter'
import { mockFunction, MockInterface } from '../utils'

describe('SalesforceAdapter filters', () => {
  const object = new ObjectType({
    elemID: new ElemID('bla', 'test'),
    annotations: { [API_NAME]: 'Bla__c' },
  })

  let adapter: SalesforceAdapter

  const createAdapter = (
    filterCreators: FilterCreator[]
  ): SalesforceAdapter => mockAdapter({ adapterParams: { filterCreators } }).adapter

  describe('when filter methods are implemented', () => {
    let filter: MockInterface<FilterWith<'onFetch' | 'onDeploy'>>

    beforeEach(() => {
      filter = {
        onFetch: mockFunction<(typeof filter)['onFetch']>().mockResolvedValue(),
        onDeploy: mockFunction<(typeof filter)['onDeploy']>().mockResolvedValue([]),
      }

      adapter = createAdapter([() => filter])
    })

    it('should call inner aspects upon fetch', async () => {
      await adapter.fetch()
      expect(filter.onFetch).toHaveBeenCalledTimes(1)
    })

    it('should call inner aspects upon deploy', async () => {
      const changes = [toChange({ after: object })]
      await adapter.deploy({ groupID: object.elemID.getFullName(), changes })
      expect(filter.onDeploy).toHaveBeenCalledTimes(1)
      const deployArgs = filter.onDeploy.mock.calls[0][0]
      expect(deployArgs).toHaveLength(1)
      expect(deployArgs[0]).toMatchObject(changes[0])
    })
  })
})
