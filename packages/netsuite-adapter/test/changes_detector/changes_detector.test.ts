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
import { NetsuiteQuery } from '../../src/query'
import * as fileCabinetDetector from '../../src/changes_detector/changes_detectors/file_cabinet'
import customRecordTypeDetector from '../../src/changes_detector/changes_detectors/custom_record_type'
import scriptDetector from '../../src/changes_detector/changes_detectors/script'
import { getChangedObjects } from '../../src/changes_detector/changes_detector'

describe('changes_detector', () => {
  const query = {
    isTypeMatch: name => name === 'customrecordtype',
  } as NetsuiteQuery
  const getCustomRecordTypeChangesMock = jest.spyOn(customRecordTypeDetector, 'getChanges').mockResolvedValue([])
  const getScriptChangesMock = jest.spyOn(scriptDetector, 'getChanges')
  const getChangedFilesMock = jest.spyOn(fileCabinetDetector, 'getChangedFiles').mockResolvedValue([])
  const getChangesFoldersMock = jest.spyOn(fileCabinetDetector, 'getChangedFolders').mockResolvedValue([])

  const runSavedSearchQueryMock = jest.fn()
  const client = {
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  beforeEach(() => {
    jest.resetAllMocks()
    getCustomRecordTypeChangesMock.mockResolvedValue([
      { type: 'object', externalId: 'a', internalId: 1 },
      { type: 'object', externalId: 'b' },
      { type: 'object', externalId: 'c', internalId: 4 },
      { type: 'type', name: 'customrecordtype' },
    ])
    getChangedFilesMock.mockResolvedValue([
      { type: 'object', externalId: '/path/to/file', internalId: 2 },
      { type: 'object', externalId: '/path/to/file2', internalId: 5 },
    ])
    getChangesFoldersMock.mockResolvedValue([{ type: 'object', externalId: '/path/to', internalId: 3 }])

    runSavedSearchQueryMock.mockResolvedValue([
      { recordid: '1' },
      { recordid: '2' },
      { recordid: '3' },
      { invalid: {} },
    ])
  })

  it('should only query requested types', async () => {
    await getChangedObjects(
      client,
      query,
      { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
    )
    expect(getCustomRecordTypeChangesMock).toHaveBeenCalled()
    expect(getScriptChangesMock).not.toHaveBeenCalled()
  })

  it('should use the system note results to filter the changes', async () => {
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
    )
    expect(changedObjectsQuery.isFileMatch('/path/to/file')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/path/to/file2')).toBeFalsy()
    expect(changedObjectsQuery.isFileMatch('/path/to')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/path/to/notExists')).toBeFalsy()

    expect(changedObjectsQuery.isObjectMatch({ type: '', scriptId: 'a' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: '', scriptId: 'b' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: '', scriptId: 'c' })).toBeFalsy()
    expect(changedObjectsQuery.isObjectMatch({ type: '', scriptId: 'd' })).toBeFalsy()

    expect(changedObjectsQuery.isObjectMatch({ type: 'customrecordtype', scriptId: 'anything' })).toBeTruthy()
    expect(changedObjectsQuery.isTypeMatch('anything')).toBeTruthy()
  })

  it('should return all the results of system note query failed', async () => {
    runSavedSearchQueryMock.mockResolvedValue(undefined)
    const changedObjectsQuery = await getChangedObjects(
      client,
      query,
      { start: new Date('2021-01-11T18:55:17.949Z'), end: new Date('2021-02-22T18:55:17.949Z') }
    )
    expect(changedObjectsQuery.isFileMatch('/path/to/file')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/path/to/file2')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/path/to')).toBeTruthy()
    expect(changedObjectsQuery.isFileMatch('/path/to/notExists')).toBeFalsy()

    expect(changedObjectsQuery.isObjectMatch({ type: '', scriptId: 'a' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: '', scriptId: 'b' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: '', scriptId: 'c' })).toBeTruthy()
    expect(changedObjectsQuery.isObjectMatch({ type: '', scriptId: 'd' })).toBeFalsy()

    expect(changedObjectsQuery.isObjectMatch({ type: 'customrecordtype', scriptId: 'anything' })).toBeTruthy()
  })
})
