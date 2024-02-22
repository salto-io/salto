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
import { getChangedCustomRecords, getCustomRecords } from '../../src/changes_detector/changes_detectors/custom_records'
import { ChangedCustomRecord } from '../../src/changes_detector/types'
import mockSdfClient from '../client/sdf_client'
import NetsuiteClient from '../../src/client/client'
import { createDateRange } from '../../src/changes_detector/date_formats'
import { TIME_DATE_FORMAT } from '../client/mocks'

describe('custom records', () => {
  const runSuiteQLMock = jest.fn()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)

  describe('query success', () => {
    let results: ChangedCustomRecord[]
    beforeEach(async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptid: 'customrecord1' },
        { scriptid: 'customrecord2' },
        { id: 'customrecord3' },
      ])
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'VAL_123' }])

      results = await getChangedCustomRecords(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
        { isCustomRecordTypeMatch: name => name !== 'customrecord2' },
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([{ typeId: 'customrecord1', objectId: 'val_123' }])
    })
    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid FROM customrecordtype  ORDER BY scriptid ASC')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(
        2,
        "SELECT scriptid FROM customrecord1 WHERE lastmodified BETWEEN TO_DATE('2021-1-11', 'YYYY-MM-DD') AND TO_DATE('2021-2-23', 'YYYY-MM-DD') ORDER BY scriptid ASC",
      )
    })
  })
  it('return nothing when custom record types query fails', async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce(undefined)
    await expect(
      getChangedCustomRecords(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT), {
        isCustomRecordTypeMatch: () => true,
      }),
    ).resolves.toHaveLength(0)
  })
  it('return nothing when custom records query fails', async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: 'customrecord1' },
      { scriptid: 'customrecord2' },
      { id: 'customrecord3' },
    ])

    runSuiteQLMock.mockResolvedValueOnce(undefined)
    await expect(
      getChangedCustomRecords(client, createDateRange(new Date(), new Date(), TIME_DATE_FORMAT), {
        isCustomRecordTypeMatch: () => true,
      }),
    ).resolves.toHaveLength(0)
  })

  describe('get custom records', () => {
    beforeEach(() => {
      runSuiteQLMock.mockReset()
    })

    it('should return nothing when custom record types query fails', async () => {
      runSuiteQLMock.mockResolvedValueOnce(undefined)

      const results = await getCustomRecords(client, { isCustomRecordTypeMatch: () => true }, new Set())

      expect(runSuiteQLMock).toHaveBeenCalledTimes(1)
      expect(results.size).toEqual(0)
    })

    it('should return nothing when all custom record types are marked as ignore', async () => {
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord1' }, { scriptid: 'customrecord2' }])

      const results = await getCustomRecords(
        client,
        { isCustomRecordTypeMatch: () => true },
        new Set(['customrecord1', 'customrecord2']),
      )

      expect(runSuiteQLMock).toHaveBeenCalledTimes(1)
      expect(results.size).toEqual(0)
    })

    it('should return nothing when relevant custom record type is marked to ignore', async () => {
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord1' }, { scriptid: 'customrecord2' }])

      const results = await getCustomRecords(
        client,
        { isCustomRecordTypeMatch: name => name === 'customrecord2' },
        new Set(['customrecord2']),
      )

      expect(runSuiteQLMock).toHaveBeenCalledTimes(1)
      expect(results.size).toEqual(0)
    })

    it('should return relevant record scripts', async () => {
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord1' }, { scriptid: 'customrecord2' }])
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord1-1' }, { scriptid: 'customrecord1-2' }])
      runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord2-1' }])

      const results = await getCustomRecords(client, { isCustomRecordTypeMatch: () => true }, new Set())

      expect(runSuiteQLMock).toHaveBeenCalledTimes(3)
      expect(results.size).toEqual(2)
      expect(results.get('customrecord1')?.size).toEqual(2)
      expect(results.get('customrecord2')?.size).toEqual(1)
      expect(results.get('customrecord1')).toContain('customrecord1-1')
      expect(results.get('customrecord1')).toContain('customrecord1-2')
      expect(results.get('customrecord2')).toContain('customrecord2-1')
    })
  })
})
