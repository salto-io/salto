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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator from '../../../src/filters/author_information/files'
import { NETSUITE, FILE, FOLDER } from '../../../src/constants'
import NetsuiteClient from '../../../src/client/client'
import { FilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'
import { EMPLOYEE_NAME_QUERY, SYSTEM_NOTE_FILE_QUERY } from '../../../src/filters/author_information/constants'

describe('netsuite system note author information', () => {
  let filterOpts: FilterOpts
  let elements: InstanceElement[]
  let fileInstance: InstanceElement
  let folderInstance: InstanceElement
  let missingInstance: InstanceElement
  const runSuiteQLMock = jest.fn()
  const runSavedSearchQueryMock = jest.fn()
  const SDFClient = mockSdfClient()
  const clientWithoutSuiteApp = new NetsuiteClient(SDFClient)
  const suiteAppClient = {
    runSuiteQL: runSuiteQLMock,
    runSavedSearchQuery: runSavedSearchQueryMock,
  } as unknown as SuiteAppClient

  const client = new NetsuiteClient(SDFClient, suiteAppClient)

  beforeEach(() => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { id: '1', entityid: 'user 1 name' },
      { id: '2', entityid: 'user 2 name' },
      { id: '3', entityid: 'user 3 name' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { recordid: '1', name: '1' },
      { recordid: '2', name: '2' },
      { recordid: '3', name: '3' },
    ])
    fileInstance = new InstanceElement(FILE, new ObjectType({ elemID: new ElemID(NETSUITE, FILE) }))
    fileInstance.value.internalId = '1'
    folderInstance = new InstanceElement(
      FOLDER, new ObjectType({ elemID: new ElemID(NETSUITE, FOLDER) })
    )
    folderInstance.value.internalId = '2'
    missingInstance = new InstanceElement(
      FILE, new ObjectType({ elemID: new ElemID(NETSUITE, FILE) })
    )
    missingInstance.value.internalId = '8'
    elements = [fileInstance, folderInstance, missingInstance]
    filterOpts = {
      client,
      elementsSourceIndex: { getIndexes: () => Promise.resolve({
        serviceIdsIndex: {},
        internalIdsIndex: {},
        customFieldsIndex: {},
      }) },
      elementsSource: buildElementsSourceFromElements([]),
      isPartial: false,
    }
  })

  it('should query information from api', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, EMPLOYEE_NAME_QUERY)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, SYSTEM_NOTE_FILE_QUERY)
    expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
  })

  it('should not query at all if there is no elements', async () => {
    await filterCreator(filterOpts).onFetch?.([])
    expect(runSuiteQLMock).not.toHaveBeenCalled()
  })

  it('should add names to elements', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(fileInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 1 name').toBeTruthy()
    expect(folderInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 2 name').toBeTruthy()
    expect(Object.values(missingInstance.annotations)).toHaveLength(0)
  })

  it('elements will stay the same if there is no author information', async () => {
    runSuiteQLMock.mockReset()
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(Object.values(fileInstance.annotations)).toHaveLength(0)
    expect(Object.values(folderInstance.annotations)).toHaveLength(0)
  })
  describe('failure', () => {
    it('bad employee schema', async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { id: '1', entityid: 'user 1 name' },
        { id: '2', entityid: 'user 2 name' },
        { id: '3', entityid: 'user 3 name' },
        { id: '1', new_value: 'wow' },
      ])
      runSuiteQLMock.mockResolvedValueOnce([
        { recordid: '1', name: '1' },
        { recordid: '2', name: '2' },
        { recordid: '3', name: '3' },
      ])
      filterCreator(filterOpts).onFetch?.(elements)
      expect(Object.values(fileInstance.annotations)).toHaveLength(0)
      expect(Object.values(folderInstance.annotations)).toHaveLength(0)
    })
    it('undefined system note result', async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { id: '1', entityid: 'user 1 name' },
        { id: '2', entityid: 'user 2 name' },
        { id: '3', entityid: 'user 3 name' },
      ])
      runSuiteQLMock.mockResolvedValueOnce(undefined)
      filterCreator(filterOpts).onFetch?.(elements)
    })
    it('bad system note schema', async () => {
      runSuiteQLMock.mockReset()
      runSuiteQLMock.mockResolvedValueOnce([
        { id: '1', entityid: 'user 1 name' },
        { id: '2', entityid: 'user 2 name' },
        { id: '3', entityid: 'user 3 name' },
      ])
      runSuiteQLMock.mockResolvedValueOnce([
        { recordid: '1', name: '1' },
        { recordid: '2', name: '2' },
        { recordid: '3', name: '3' },
        { newValue: '3' },
      ])
      filterCreator(filterOpts).onFetch?.(elements)
      expect(Object.values(fileInstance.annotations)).toHaveLength(0)
      expect(Object.values(folderInstance.annotations)).toHaveLength(0)
    })
  })

  describe('no suite app client', () => {
    beforeEach(() => {
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: { getIndexes: () => Promise.resolve({
          serviceIdsIndex: {},
          internalIdsIndex: {},
          customFieldsIndex: {},
        }) },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
      }
    })
    it('should not change any elements in fetch', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(Object.values(fileInstance.annotations)).toHaveLength(0)
    })
  })
})
