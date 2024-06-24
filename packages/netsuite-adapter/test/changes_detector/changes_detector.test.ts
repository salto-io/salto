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
import { NetsuiteQuery } from '../../src/config/query'
import * as fileCabinetDetector from '../../src/changes_detector/changes_detectors/file_cabinet'
import customRecordTypeDetector from '../../src/changes_detector/changes_detectors/custom_record_type'
import scriptDetector from '../../src/changes_detector/changes_detectors/script'
import { getChangedObjects } from '../../src/changes_detector/changes_detector'
import NetsuiteClient from '../../src/client/client'
import mockSdfClient from '../client/sdf_client'
import { createDateRange } from '../../src/changes_detector/date_formats'
import { TIME_DATE_FORMAT } from '../client/mocks'

describe('changes_detector', () => {
  const query = {
    isTypeMatch: (name: string) => name === 'customrecordtype',
    isFileMatch: () => true,
    areSomeFilesMatch: () => true,
  } as unknown as NetsuiteQuery
  const getCustomRecordTypeChangesMock = jest.spyOn(customRecordTypeDetector, 'getChanges').mockResolvedValue([])
  const getScriptChangesMock = jest.spyOn(scriptDetector, 'getChanges')
  const getChangedFilesMock = jest.spyOn(fileCabinetDetector, 'getChangedFiles').mockResolvedValue([])
  const getChangesFoldersMock = jest.spyOn(fileCabinetDetector, 'getChangedFolders').mockResolvedValue([])

  const runSuiteQLMock = jest.fn()
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)
  let serviceIdToLastFetchDate: Record<string, Date> = {}

  beforeEach(() => {
    jest.resetAllMocks()
    getCustomRecordTypeChangesMock.mockResolvedValue([
      { type: 'object', objectId: 'A', time: new Date('03/15/2020 03:04 pm') },
      { type: 'object', objectId: 'B', time: new Date('03/15/2020 03:04 pm') },
      { type: 'object', objectId: 'B', time: new Date('03/15/2023 03:04 pm') },
      { type: 'object', objectId: 'C', time: new Date('03/15/2020 03:04 pm') },
      { type: 'type', name: 'customrecordtype' },
    ])
    getChangedFilesMock.mockResolvedValue([
      { type: 'object', objectId: '/Templates/path/to/file', time: new Date('03/15/2020 03:04 pm') },
      { type: 'object', objectId: '/Templates/path/to/file2', time: new Date('03/15/2023 03:04 pm') },
      { type: 'object', objectId: '/other/path/to/file', time: new Date('03/15/2020 03:04 pm') },
    ])
    getChangesFoldersMock.mockResolvedValue([
      { type: 'object', objectId: '/Templates/path/to', time: new Date('03/15/2021 03:04 pm') },
    ])
  })

  it('should only query requested types', async () => {
    await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(getCustomRecordTypeChangesMock).toHaveBeenCalled()
    expect(getScriptChangesMock).not.toHaveBeenCalled()
  })

  it('should match any file under a directory if not other file under the directory was changed', async () => {
    getChangedFilesMock.mockResolvedValue([])
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2022-01-11T18:55:17.949Z'), new Date('2022-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/anyFile')).toBeTruthy()
  })

  it('should match the file direct parent directory if the file was changed', async () => {
    getChangedFilesMock.mockResolvedValue([
      { type: 'object', objectId: '/Templates/path/to/file', time: new Date('03/15/2020 03:04 pm') },
    ])
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2022-01-11T18:55:17.949Z'), new Date('2022-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/')).toBeFalsy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/irrelevantFile')).toBeFalsy()
  })

  it('should match types that are not supported by the changes detector', async () => {
    getCustomRecordTypeChangesMock.mockResolvedValue([])
    getChangedFilesMock.mockResolvedValue([])
    getChangesFoldersMock.mockResolvedValue([])

    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(changedObjectsQuery.isTypeMatch('addressForm')).toBeTruthy()
  })

  it('should match custom records', async () => {
    runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord1' }, { scriptid: 'customrecord2' }])
    runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'VAL_123' }])
    const changedObjectsQuery = await getChangedObjects(
      client,
      {
        isTypeMatch: () => false,
        isFileMatch: () => false,
        areSomeFilesMatch: () => false,
        isCustomRecordTypeMatch: (name: string) => name === 'customrecord1',
      } as unknown as NetsuiteQuery,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(changedObjectsQuery.isTypeMatch('customrecordtype')).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'customrecordtype', instanceId: 'customrecord1' })).toBeTruthy()
    expect(changedObjectsQuery.isCustomRecordTypeMatch('customrecord1')).toBeTruthy()
    expect(changedObjectsQuery.isCustomRecordMatch({ type: 'customrecord1', instanceId: 'val_123' })).toBeTruthy()

    expect(changedObjectsQuery.isCustomRecordTypeMatch('customrecord2')).toBeFalsy()

    expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
    expect(runSuiteQLMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'customrecordtype' }))
    expect(runSuiteQLMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'customrecord1' }))
  })

  it('should match custom records of custom segments', async () => {
    runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'customrecord_cseg1' }, { scriptid: 'customrecord2' }])
    runSuiteQLMock.mockResolvedValueOnce([{ scriptid: 'VAL_123' }])
    const changedObjectsQuery = await getChangedObjects(
      client,
      {
        isTypeMatch: () => false,
        isFileMatch: () => false,
        areSomeFilesMatch: () => false,
        isCustomRecordTypeMatch: (name: string) => name === 'customrecord_cseg1',
      } as unknown as NetsuiteQuery,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(changedObjectsQuery.isTypeMatch('customsegment')).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'customsegment', instanceId: 'cseg1' })).toBeTruthy()
    expect(changedObjectsQuery.isCustomRecordTypeMatch('customrecord_cseg1')).toBeTruthy()
    expect(changedObjectsQuery.isCustomRecordMatch({ type: 'customrecord_cseg1', instanceId: 'val_123' })).toBeTruthy()

    expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
    expect(runSuiteQLMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'customrecordtype' }))
    expect(runSuiteQLMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'customrecord_cseg1' }))
  })

  it('should return all the results of system note query failed', async () => {
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file2')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/notExists')).toBeFalsy()

    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'a' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'b' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'c' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'd' })).toBeFalsy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'notSupported', instanceId: 'd' })).toBeTruthy()

    expect(changedObjectsQuery.isObjectMatch({ type: 'customrecordtype', instanceId: 'anything' })).toBeTruthy()
  })

  it('should not return results that there last fetch time is later than the query return time', async () => {
    serviceIdToLastFetchDate = {
      '/Templates/path/to/file': new Date('2022-02-22T18:55:17.949Z'),
      '/Templates/path/to/file2': new Date('2022-02-22T18:55:17.949Z'),
      a: new Date('2022-02-22T18:55:17.949Z'),
      b: new Date('2022-02-22T18:55:17.949Z'),
    }
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )

    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file')).toBeFalsy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file2')).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'a' })).toBeFalsy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'b' })).toBeTruthy()
  })

  it('should not call file cabinet detectors when no files/folders included', async () => {
    const changedObjectsQuery = await getChangedObjects(
      client,
      {
        isTypeMatch: () => false,
        isFileMatch: () => false,
        areSomeFilesMatch: () => false,
        isCustomRecordTypeMatch: () => false,
      } as unknown as NetsuiteQuery,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(changedObjectsQuery.areSomeFilesMatch()).toBeFalsy()
    expect(getChangedFilesMock).not.toHaveBeenCalled()
    expect(getChangesFoldersMock).not.toHaveBeenCalled()
  })

  it('areSomeFilesMatch return false when no file changes were detected', async () => {
    getChangedFilesMock.mockResolvedValue([])
    getChangesFoldersMock.mockResolvedValue([])
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z'), TIME_DATE_FORMAT),
      serviceIdToLastFetchDate,
    )
    expect(changedObjectsQuery.areSomeFilesMatch()).toBeFalsy()
  })
})
