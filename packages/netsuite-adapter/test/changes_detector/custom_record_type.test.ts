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
import detector from '../../src/changes_detector/changes_detectors/custom_record_type'
import { Change } from '../../src/changes_detector/types'
import mockSdfClient from '../client/sdf_client'
import NetsuiteClient from '../../src/client/client'
import { createDateRange, toSuiteQLSelectDateString } from '../../src/changes_detector/date_formats'
import { TIME_DATE_FORMAT } from '../client/mocks'

describe('custom_record_type', () => {
  const runSuiteQLMock = jest.fn()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)

  describe('query success', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValue([
        { scriptid: 'customrecord_a', time: '2021-03-15 00:00:00' },
        { scriptid: 'customrecord_b', time: '2021-03-16 00:00:00' },
      ])
      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { type: 'object', objectId: 'customrecord_a', time: new Date('2021-03-15T00:00:00.000Z') },
        { type: 'object', objectId: 'customrecord_b', time: new Date('2021-03-16T00:00:00.000Z') },
        { type: 'object', objectId: 'a', time: new Date('2021-03-15T00:00:00.000Z') },
        { type: 'object', objectId: 'b', time: new Date('2021-03-16T00:00:00.000Z') },
      ])
    })

    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenCalledWith({
        select: `internalid, scriptid, ${toSuiteQLSelectDateString('lastmodifieddate')} AS time`,
        from: 'customrecordtype',
        where: "lastmodifieddate BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD')",
        orderBy: 'internalid',
      })
    })
  })

  describe('query success with invalid results', () => {
    let results: Change[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValue([
        { scriptid: 'customrecord_a', time: '2021-03-15 00:00:00' },
        { scriptid: 'customrecord_b', time: '2021-03-16 00:00:00' },
        { qqq: 'b' },
        { scriptid: {} },
      ])
      results = await detector.getChanges(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      )
    })
    it('should return the changes without the invalid results', () => {
      expect(results).toEqual([
        { type: 'object', objectId: 'customrecord_a', time: new Date('2021-03-15T00:00:00.000Z') },
        { type: 'object', objectId: 'customrecord_b', time: new Date('2021-03-16T00:00:00.000Z') },
        { type: 'object', objectId: 'a', time: new Date('2021-03-15T00:00:00.000Z') },
        { type: 'object', objectId: 'b', time: new Date('2021-03-16T00:00:00.000Z') },
      ])
    })
  })
  it('return nothing when query fails', async () => {
    runSuiteQLMock.mockResolvedValue(undefined)
    expect(await detector.getChanges(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT))).toHaveLength(0)
  })
})
