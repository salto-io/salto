/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import detector, { SUPPORTED_TYPES } from '../../src/changes_detector/changes_detectors/script'
import { Change } from '../../src/changes_detector/types'
import NetsuiteClient from '../../src/client/client'
import mockSdfClient from '../client/sdf_client'
import { createDateRange, toSuiteQLSelectDateString } from '../../src/changes_detector/date_formats'

describe('script', () => {
  const runSuiteQLMock = jest.fn()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)
  const timeDateFormat = 'YYYY-MM-DD h:mm a'

  describe('script fields changes', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptscriptid: 'a', id: '1' },
        { scriptscriptid: 'b', id: '2' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptscriptid: 'c', id: '3' },
        { scriptscriptid: 'd', id: '4' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([
        {
          lastmodifieddate: '03/15/2021',
        },
      ])

      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), timeDateFormat),
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual(
        SUPPORTED_TYPES.map(name => ({
          type: 'type',
          name,
        })),
      )
    })
  })

  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptscriptid: 'a', time: '2021-01-14 18:55:15' },
        { scriptscriptid: 'b', time: '2021-01-14 18:55:15' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptscriptid: 'c', time: '2021-01-14 18:55:15' },
        { scriptscriptid: 'd', time: '2021-01-14 18:55:15' },
        { invalid: 0 },
      ])
      runSuiteQLMock.mockResolvedValueOnce([])

      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), timeDateFormat),
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', objectId: 'a', time: new Date('2021-01-14T18:55:15.000Z') },
        { type: 'object', objectId: 'b', time: new Date('2021-01-14T18:55:15.000Z') },
        { type: 'object', objectId: 'c', time: new Date('2021-01-14T18:55:15.000Z') },
        { type: 'object', objectId: 'd', time: new Date('2021-01-14T18:55:15.000Z') },
      ])
    })

    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(
        1,

        {
          select: `script.scriptid as scriptscriptid, ${toSuiteQLSelectDateString('MAX(systemnote.date)')} as time`,
          from: 'script',
          join: 'systemnote ON systemnote.recordid = script.id',
          where:
            "systemnote.date BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD') AND systemnote.recordtypeid = -417",
          groupBy: 'script.scriptid',
          orderBy: 'scriptscriptid',
        },
      )

      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, {
        select: `script.scriptid as scriptscriptid, ${toSuiteQLSelectDateString('MAX(systemnote.date)')} as time`,
        from: 'scriptdeployment',
        join: 'systemnote ON systemnote.recordid = scriptdeployment.primarykey JOIN script ON scriptdeployment.script = script.id',
        where:
          "systemnote.date BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD') AND systemnote.recordtypeid = -418",
        groupBy: 'script.scriptid',
        orderBy: 'scriptscriptid',
      })

      expect(runSuiteQLMock).toHaveBeenNthCalledWith(3, {
        select: 'internalid',
        from: 'customfield',
        where:
          "fieldtype = 'SCRIPT' AND lastmodifieddate BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD')",
        orderBy: 'internalid',
      })
    })
  })

  it('return nothing when roles query fails', async () => {
    runSuiteQLMock.mockResolvedValue(undefined)
    expect(await detector.getChanges(client, createDateRange(new Date(), new Date(), timeDateFormat))).toHaveLength(0)
  })
})
