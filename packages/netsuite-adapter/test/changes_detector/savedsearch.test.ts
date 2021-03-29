/*
*                      Copyright 2021 Salto Labs Ltd.
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
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import detector from '../../src/changes_detector/changes_detectors/savedsearch'
import { Change } from '../../src/changes_detector/types'
import NetsuiteClient from '../../src/client/client'
import mockSdfClient from '../client/sdf_client'
import { createDateRange } from '../../src/changes_detector/date_formats'

describe('savedsearch', () => {
  const runSavedSearchQueryMock = jest.fn()
  const suiteAppClient = {
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)


  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSavedSearchQueryMock.mockReset()
      runSavedSearchQueryMock.mockResolvedValue([
        { id: 'a', datemodified: '03/15/2021 03:04 pm' },
        { id: 'b', datemodified: '03/15/2021 03:05 pm' },
        { invalid: 0 }])
      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'))
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', externalId: 'a', time: new Date('2021-03-15T15:05:00.000Z') },
        { type: 'object', externalId: 'b', time: new Date('2021-03-15T15:06:00.000Z') },
      ])
    })

    it('should make the right query', () => {
      expect(runSavedSearchQueryMock).toHaveBeenCalledWith({
        type: 'savedsearch',
        columns: ['id'],
        filters: [['datemodified', 'within', '1/11/2021 6:55 pm', '2/22/2021 6:56 pm']],
      })
    })
  })

  it('return nothing when query fails', async () => {
    runSavedSearchQueryMock.mockResolvedValue(undefined)
    expect(
      await detector.getChanges(client, createDateRange(new Date(), new Date()))
    ).toHaveLength(0)
  })
})
