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
import { customFieldDetector as detector } from '../../src/changes_detector/changes_detectors/custom_type'
import { Change } from '../../src/changes_detector/types'

describe('custom_field', () => {
  const runSuiteQLMock = jest.fn()
  const client = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient


  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValue([{ scriptid: 'a' }, { scriptid: 'b' }])
      results = await detector.getChanges(
        client,
        { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', externalId: 'a' },
        { type: 'object', externalId: 'b' },
      ])
    })

    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenCalledWith(`
      SELECT scriptid
      FROM customfield
      WHERE lastmodifieddate BETWEEN '1/11/2021' AND '2/23/2021'
    `)
    })
  })

  describe('query success with invalid results', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValue([{ scriptid: 'a' }, { scriptid: 'b' }, { qqq: 'b' }, { scriptid: {} }])
      results = await detector.getChanges(
        client,
        { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
      )
    })
    it('should return the changes without the invalid results', () => {
      expect(results).toEqual([
        { type: 'object', externalId: 'a' },
        { type: 'object', externalId: 'b' },
      ])
    })
  })
  it('return nothing when query fails', async () => {
    runSuiteQLMock.mockResolvedValue(undefined)
    expect(
      await detector.getChanges(client, { start: new Date(), end: new Date() })
    ).toHaveLength(0)
  })
})
