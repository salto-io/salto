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
import { NetsuiteQuery } from '../../src/query'
import * as fileCabinetDetector from '../../src/changes_detector/changes_detectors/file_cabinet'
import customRecordTypeDetector from '../../src/changes_detector/changes_detectors/custom_record_type'
import scriptDetector from '../../src/changes_detector/changes_detectors/script'
import { getChangedObjects } from '../../src/changes_detector/changes_detector'
import NetsuiteClient from '../../src/client/client'
import mockSdfClient from '../client/sdf_client'
import { createDateRange } from '../../src/changes_detector/date_formats'

describe('changes_detector', () => {
  const query = {
    isTypeMatch: (name: string) => name === 'customrecordtype',
    isFileMatch: () => true,
  } as unknown as NetsuiteQuery
  const getCustomRecordTypeChangesMock = jest.spyOn(customRecordTypeDetector, 'getChanges').mockResolvedValue([])
  const getScriptChangesMock = jest.spyOn(scriptDetector, 'getChanges')
  const getChangedFilesMock = jest.spyOn(fileCabinetDetector, 'getChangedFiles').mockResolvedValue([])
  const getChangesFoldersMock = jest.spyOn(fileCabinetDetector, 'getChangedFolders').mockResolvedValue([])

  const runSavedSearchQueryMock = jest.fn()
  const suiteAppClient = {
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(mockSdfClient(), suiteAppClient)

  const getIndexesMock = jest.fn()
  const elementsSourceIndex = {
    getIndexes: getIndexesMock,
  }

  beforeEach(() => {
    jest.resetAllMocks()
    getCustomRecordTypeChangesMock.mockResolvedValue([
      { type: 'object', externalId: 'A', internalId: 1 },
      { type: 'object', externalId: 'B', time: new Date('03/15/2020 03:04 pm') },
      { type: 'object', externalId: 'B', time: new Date('03/15/2023 03:04 pm') },
      { type: 'object', externalId: 'C', internalId: 4 },
      { type: 'type', name: 'customrecordtype' },
    ])
    getChangedFilesMock.mockResolvedValue([
      { type: 'object', externalId: '/Templates/path/to/file', internalId: 2 },
      { type: 'object', externalId: '/Templates/path/to/file2', internalId: 5 },
      { type: 'object', externalId: '/other/path/to/file', internalId: 6 },
    ])
    getChangesFoldersMock.mockResolvedValue([{ type: 'object', externalId: '/Templates/path/to', internalId: 3 }])

    runSavedSearchQueryMock.mockResolvedValue([
      { recordid: '1', date: '03/15/2021 03:04 pm' },
      { recordid: '2', date: '03/15/2021 03:04 am' },
      { recordid: '3', date: '03/15/2021 03:04 pm' },
      { recordid: '3', date: '03/15/2023 03:04 pm' },
      { recordid: '6', date: '03/15/2023 03:04 pm' },
      { invalid: {} },
    ])

    getIndexesMock.mockResolvedValue({
      serviceIdsIndex: {},
      internalIdsIndex: {},
    })
  })

  it('should only query requested types', async () => {
    await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
      elementsSourceIndex,
    )
    expect(getCustomRecordTypeChangesMock).toHaveBeenCalled()
    expect(getScriptChangesMock).not.toHaveBeenCalled()
  })

  it('should use the system note results to filter the changes', async () => {
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
      elementsSourceIndex,
    )
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file2')).toBeFalsy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/notExists')).toBeFalsy()
    expect(changedObjectsQuery.isFileMatch('/other/path/to/file')).toBeTruthy()


    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'a' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'b' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'c' })).toBeFalsy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'd' })).toBeFalsy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'notSupported', instanceId: 'd' })).toBeTruthy()

    expect(changedObjectsQuery.isObjectMatch({ type: 'customrecordtype', instanceId: 'anything' })).toBeTruthy()
    expect(changedObjectsQuery.isTypeMatch('anything')).toBeTruthy()

    expect(changedObjectsQuery.areSomeFilesMatch()).toBeTruthy()
  })

  it('should match any file under a directory if not other file under the directory was changed', async () => {
    getChangedFilesMock.mockResolvedValue([])
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2022-01-11T18:55:17.949Z'), new Date('2022-02-22T18:55:17.949Z')),
      elementsSourceIndex,
    )
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/anyFile')).toBeTruthy()
  })

  it('should match types that are not supported by the changes detector', async () => {
    getCustomRecordTypeChangesMock.mockResolvedValue([])
    getChangedFilesMock.mockResolvedValue([])
    getChangesFoldersMock.mockResolvedValue([])
    runSavedSearchQueryMock.mockResolvedValue([])

    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
      elementsSourceIndex,
    )
    expect(changedObjectsQuery.isTypeMatch('addressForm')).toBeTruthy()
  })

  it('should return all the results of system note query failed', async () => {
    runSavedSearchQueryMock.mockResolvedValue(undefined)
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
      elementsSourceIndex,
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
    runSavedSearchQueryMock.mockResolvedValue([
      { recordid: '1', date: '03/15/2021 03:04 pm' },
      { recordid: '2', date: '03/15/2021 03:04 am' },
      { recordid: '5', date: '03/15/2023 03:04 pm' },
      { recordid: '3', date: '03/15/2023 03:04 pm' },
      { recordid: '6', date: '03/15/2023 03:04 pm' },
      { invalid: {} },
    ])

    getIndexesMock.mockResolvedValue(
      {
        serviceIdsIndex: {
          '/Templates/path/to/file': { lastFetchTime: new Date('2022-02-22T18:55:17.949Z') },
          '/Templates/path/to/file2': { lastFetchTime: new Date('2022-02-22T18:55:17.949Z') },
          a: { lastFetchTime: new Date('2022-02-22T18:55:17.949Z') },
          b: { lastFetchTime: new Date('2022-02-22T18:55:17.949Z') },
        },
        internalIdsIndex: {},
      }
    )
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
      elementsSourceIndex,
    )

    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file')).toBeFalsy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file2')).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'a' })).toBeFalsy()
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'b' })).toBeTruthy()
  })

  it('areSomeFilesMatch return false when no file changes were detected', async () => {
    getChangedFilesMock.mockResolvedValue([])
    getChangesFoldersMock.mockResolvedValue([])
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
      elementsSourceIndex,
    )
    expect(changedObjectsQuery.areSomeFilesMatch()).toBeFalsy()
  })

  it('should return the results when SystemNote time is invalid', async () => {
    runSavedSearchQueryMock.mockResolvedValue([
      { recordid: '1', date: 'invalid' },
    ])
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
      elementsSourceIndex,
    )
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'a' })).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/Templates/path/to/file')).toBeFalsy()
  })

  it('should return the results when the results time is invalid', async () => {
    getIndexesMock.mockResolvedValue({
      serviceIdsIndex: {
        b: { lastFetchTime: new Date('2022-02-22T18:55:17.949Z') },
      },
      internalIdsIndex: {},
    })

    getCustomRecordTypeChangesMock.mockResolvedValue([
      { type: 'object', externalId: 'B', time: undefined },
    ])
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      createDateRange(new Date('2021-01-11T18:55:17.949Z'), new Date('2021-02-22T18:55:17.949Z')),
      elementsSourceIndex,
    )
    expect(changedObjectsQuery.isObjectMatch({ type: 'workflow', instanceId: 'b' })).toBeTruthy()
  })
})
