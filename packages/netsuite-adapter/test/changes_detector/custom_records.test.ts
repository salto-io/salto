/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { getChangedCustomRecords } from '../../src/changes_detector/changes_detectors/custom_records'
import { ChangedCustomRecord } from '../../src/changes_detector/types'
import mockSdfClient from '../client/sdf_client'
import NetsuiteClient from '../../src/client/client'
import { createDateRange } from '../../src/changes_detector/date_formats'

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
      runSuiteQLMock.mockResolvedValueOnce([
        { scriptid: 'VAL_123' },
      ])

      results = await getChangedCustomRecords(
        client,
        createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
        { isCustomRecordTypeMatch: name => name !== 'customrecord2' },
      )
    })
    it('should return the changes', () => {
      expect(results).toEqual([
        { typeId: 'customrecord1', objectId: 'val_123' },
      ])
    })
    it('should make the right query', () => {
      expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, 'SELECT scriptid FROM customrecordtype  ORDER BY scriptid ASC')
      expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, 'SELECT scriptid FROM customrecord1 WHERE lastmodified BETWEEN TO_DATE(\'2021-1-11\', \'YYYY-MM-DD\') AND TO_DATE(\'2021-2-23\', \'YYYY-MM-DD\') ORDER BY scriptid ASC')
    })
  })
  it('return nothing when custom record types query fails', async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce(undefined)
    await expect(getChangedCustomRecords(
      client,
      createDateRange(new Date(), new Date()),
      { isCustomRecordTypeMatch: () => true },
    )).resolves.toHaveLength(0)
  })
  it('return nothing when custom records query fails', async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { scriptid: 'customrecord1' },
      { scriptid: 'customrecord2' },
      { id: 'customrecord3' },
    ])

    runSuiteQLMock.mockResolvedValueOnce(undefined)
    await expect(getChangedCustomRecords(
      client,
      createDateRange(new Date(), new Date()),
      { isCustomRecordTypeMatch: () => true },
    )).resolves.toHaveLength(0)
  })
})
