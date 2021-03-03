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
import { SuiteAppClient } from '../../src/client/suiteapp_client/suiteapp_client'
import detector from '../../src/changes_detector/changes_detectors/workflow'
import { Change } from '../../src/changes_detector/types'

describe('workflow', () => {
  const runSavedSearchQueryMock = jest.fn()
  const client = {
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient


  describe('query success', () => {
    describe('There are changes', () => {
      let results: Change[]
      beforeEach(async () => {
        runSavedSearchQueryMock.mockReset()
        runSavedSearchQueryMock.mockResolvedValue([{ recordid: 'a' }])
        results = await detector.getChanges(
          client,
          { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T06:55:17.949Z') }
        )
      })
      it('should return the type', () => {
        expect(results).toEqual([
          { type: 'type', name: 'workflow' },
        ])
      })

      it('should make the right query', () => {
        expect(runSavedSearchQueryMock).toHaveBeenCalledWith({
          type: 'systemnote',
          filters: [
            ['recordtype', 'is', '-129'],
            'and',
            ['date', 'within', '1/11/2021 6:55 pm', '2/22/2021 6:56 am'],
          ],
          columns: ['recordid'],
        })
      })
    })

    describe('There are no changes', () => {
      let results: Change[]
      beforeEach(async () => {
        runSavedSearchQueryMock.mockReset()
        runSavedSearchQueryMock.mockResolvedValue([])
        results = await detector.getChanges(
          client,
          { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
        )
      })
      it('should return nothing', () => {
        expect(results).toEqual([])
      })
    })
  })

  it('return nothing when query fails', async () => {
    runSavedSearchQueryMock.mockResolvedValue(undefined)
    expect(
      await detector.getChanges(client, { start: new Date(), end: new Date() })
    ).toHaveLength(0)
  })
})
