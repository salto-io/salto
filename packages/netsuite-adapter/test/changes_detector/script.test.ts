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
import detector, { SCRIPT_TYPES } from '../../src/changes_detector/changes_detectors/script'
import { Change } from '../../src/changes_detector/types'

describe('script', () => {
  const runSuiteQLMock = jest.fn()
  const client = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient

  describe('script fields changes', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptid: 'a', id: '1' },
        { scriptid: 'b', id: '2' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptid: 'c', id: '3' },
        { scriptid: 'd', id: '4' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([{}])

      results = await detector.getChanges(
        client,
        { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual(SCRIPT_TYPES.map(name => ({
        type: 'type',
        name,
      })))
    })
  })


  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptid: 'a', id: '1' },
        { scriptid: 'b', id: '2' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptid: 'c', id: '3' },
        { scriptid: 'd', id: '4' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([])

      results = await detector.getChanges(
        client,
        { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', externalId: 'a', internalId: 1 },
        { type: 'object', externalId: 'b', internalId: 2 },
        { type: 'object', externalId: 'c', internalId: 3 },
        { type: 'object', externalId: 'd', internalId: 4 },
      ])
    })

    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, `
      SELECT script.scriptid, script.id
      FROM script
      JOIN systemnote ON systemnote.recordid = script.id
      WHERE systemnote.date BETWEEN '1/11/2021' AND '2/22/2021' AND systemnote.recordtypeid = -417
    `)

      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, `
      SELECT script.scriptid, script.id
      FROM scriptdeployment 
      JOIN systemnote ON systemnote.recordid = scriptdeployment.primarykey
      JOIN script ON scriptdeployment.script = script.id
      WHERE systemnote.date BETWEEN '1/11/2021' AND '2/22/2021' AND systemnote.recordtypeid = -418
    `)

      expect(runSuiteQLMock).toHaveBeenNthCalledWith(3, `
      SELECT internalid
      FROM customfield
      WHERE fieldtype = 'SCRIPT' AND lastmodifieddate BETWEEN '1/11/2021' AND '2/22/2021'
    `)
    })
  })

  it('return nothing when roles query fails', async () => {
    runSuiteQLMock.mockResolvedValue(undefined)
    expect(
      await detector.getChanges(client, { start: new Date(), end: new Date() })
    ).toHaveLength(0)
  })
})
