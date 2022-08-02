/*
*                      Copyright 2022 Salto Labs Ltd.
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
import filterCreator, { FILE_FIELD_IDENTIFIER, FOLDER_FIELD_IDENTIFIER } from '../../../src/filters/author_information/system_note'
import { FILE, FOLDER, NETSUITE } from '../../../src/constants'
import { createServerTimeElements } from '../../../src/server_time'
import NetsuiteClient from '../../../src/client/client'
import { FilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'
import { EMPLOYEE_NAME_QUERY } from '../../../src/filters/author_information/constants'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../../utils'

describe('netsuite system note author information', () => {
  let filterOpts: FilterOpts
  let elements: InstanceElement[]
  let fileInstance: InstanceElement
  let folderInstance: InstanceElement
  let accountInstance: InstanceElement
  let customTypeInstance: InstanceElement
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

  beforeEach(async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { id: '1', entityid: 'user 1 name' },
      { id: '2', entityid: 'user 2 name' },
      { id: '3', entityid: 'user 3 name' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { recordid: '1', recordtypeid: '-112', field: '', name: '1' },
      { recordid: '1', recordtypeid: '-123', field: '', name: '2' },
      { recordid: '2', recordtypeid: '-112', field: '', name: '3' },
      { recordid: '2', field: FOLDER_FIELD_IDENTIFIER, name: '3' },
      { recordid: '2', field: FILE_FIELD_IDENTIFIER, name: '3' },
    ])
    accountInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    accountInstance.value.internalId = '1'
    customTypeInstance = new InstanceElement('customRecordType', new ObjectType({ elemID: new ElemID(NETSUITE, 'customRecordType') }))
    customTypeInstance.value.internalId = '1'
    fileInstance = new InstanceElement(FILE, new ObjectType({ elemID: new ElemID(NETSUITE, FILE) }))
    fileInstance.value.internalId = '2'
    folderInstance = new InstanceElement(
      FOLDER, new ObjectType({ elemID: new ElemID(NETSUITE, FOLDER) })
    )
    folderInstance.value.internalId = '2'
    missingInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    missingInstance.value.internalId = '8'
    elements = [accountInstance, customTypeInstance, missingInstance, fileInstance, folderInstance]
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements(createServerTimeElements(new Date('2022-01-01'))),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })

  it('should query information from api', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    const fieldSystemNotesQuery = "SELECT name, field, recordid from (SELECT name, field, recordid, MAX(date) AS date FROM (SELECT name, REGEXP_SUBSTR(field, '^(MEDIAITEMFOLDER.|MEDIAITEM.)') AS field, recordid, date FROM systemnote WHERE date >= TO_DATE('2022-01-01', 'YYYY-MM-DD') AND (field LIKE 'MEDIAITEM.%' OR field LIKE 'MEDIAITEMFOLDER.%')) GROUP BY name, field, recordid) ORDER BY name, field, recordid DESC"
    const recordTypeSystemNotesQuery = "SELECT name, recordid, recordtypeid FROM (SELECT name, recordid, recordtypeid, MAX(date) as date FROM systemnote WHERE date >= TO_DATE('2022-01-01', 'YYYY-MM-DD') AND (recordtypeid = '-112' OR recordtypeid = '-123') GROUP BY name, recordid, recordtypeid) ORDER BY name, recordid, recordtypeid DESC"
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, EMPLOYEE_NAME_QUERY)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, fieldSystemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(3, recordTypeSystemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenCalledTimes(3)
  })

  it('should query information from api when there are no files', async () => {
    await filterCreator(filterOpts).onFetch?.(
      [accountInstance, customTypeInstance, missingInstance]
    )
    const systemNotesQuery = "SELECT name, recordid, recordtypeid FROM (SELECT name, recordid, recordtypeid, MAX(date) as date FROM systemnote WHERE date >= TO_DATE('2022-01-01', 'YYYY-MM-DD') AND (recordtypeid = '-112' OR recordtypeid = '-123') GROUP BY name, recordid, recordtypeid) ORDER BY name, recordid, recordtypeid DESC"
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, EMPLOYEE_NAME_QUERY)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, systemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenCalledTimes(2)
  })

  it('should not query at all if there is no elements', async () => {
    await filterCreator(filterOpts).onFetch?.([])
    expect(runSuiteQLMock).not.toHaveBeenCalled()
  })

  it('should add names to elements', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(accountInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 1 name').toBeTruthy()
    expect(customTypeInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 2 name').toBeTruthy()
    expect(Object.values(missingInstance.annotations)).toHaveLength(0)
    expect(fileInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
    expect(folderInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
  })

  it('elements will stay the same if there is no author information', async () => {
    runSuiteQLMock.mockReset()
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(Object.values(accountInstance.annotations)).toHaveLength(0)
    expect(Object.values(customTypeInstance.annotations)).toHaveLength(0)
    expect(Object.values(fileInstance.annotations)).toHaveLength(0)
    expect(Object.values(folderInstance.annotations)).toHaveLength(0)
  })
  it('should use elemIdToChangeByIndex to get the author if there is no new author information', async () => {
    runSuiteQLMock.mockReset()
    const opts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve({
          ...createEmptyElementsSourceIndexes(),
          elemIdToChangeByIndex: {
            [missingInstance.elemID.getFullName()]: 'another user name',
          },
        }),
      },
      elementsSource: buildElementsSourceFromElements(createServerTimeElements(new Date('2022-01-01'))),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
    await filterCreator(opts).onFetch?.(elements)
    expect(missingInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'another user name').toBeTruthy()
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
        { recordid: '1', recordtypeid: '-112', name: '1' },
        { recordid: '1', recordtypeid: '-123', name: '2' },
        { recordid: '2', recordtypeid: '-112', name: '3' },
      ])
      filterCreator(filterOpts).onFetch?.(elements)
      expect(Object.values(accountInstance.annotations)).toHaveLength(0)
      expect(Object.values(customTypeInstance.annotations)).toHaveLength(0)
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
        { recordid: '1', recordtypeid: '-112', name: '1' },
        { recordid: '1', recordtypeid: '-123', name: '2' },
        { recordid: '2', recordtypeid: '-112', name: '3' },
        { recordid: '1', test: 'wow', name: '1' },
      ])
      filterCreator(filterOpts).onFetch?.(elements)
      expect(Object.values(accountInstance.annotations)).toHaveLength(0)
      expect(Object.values(customTypeInstance.annotations)).toHaveLength(0)
      expect(Object.values(fileInstance.annotations)).toHaveLength(0)
      expect(Object.values(folderInstance.annotations)).toHaveLength(0)
    })
  })

  describe('no suite app client', () => {
    beforeEach(async () => {
      filterOpts = {
        client: clientWithoutSuiteApp,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
    })
    it('should not change any elements in fetch', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(Object.values(accountInstance.annotations)).toHaveLength(0)
      expect(Object.values(customTypeInstance.annotations)).toHaveLength(0)
      expect(Object.values(fileInstance.annotations)).toHaveLength(0)
      expect(Object.values(folderInstance.annotations)).toHaveLength(0)
    })
  })

  describe('on first fetch', () => {
    beforeEach(async () => {
      filterOpts = {
        client,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: await getDefaultAdapterConfig(),
      }
    })
    it('should not change any elements in fetch', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(Object.values(accountInstance.annotations)).toHaveLength(0)
      expect(Object.values(customTypeInstance.annotations)).toHaveLength(0)
      expect(Object.values(fileInstance.annotations)).toHaveLength(0)
      expect(Object.values(folderInstance.annotations)).toHaveLength(0)
    })
  })

  describe('authorInformation.enable is false', () => {
    beforeEach(async () => {
      const defaultConfig = await getDefaultAdapterConfig()
      filterOpts = {
        client,
        elementsSourceIndex: {
          getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
        },
        elementsSource: buildElementsSourceFromElements([]),
        isPartial: false,
        config: {
          ...defaultConfig,
          fetch: {
            ...defaultConfig.fetch,
            authorInformation: {
              enable: false,
            },
          },
        },
      }
    })
    it('should not change any elements in fetch', async () => {
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(Object.values(accountInstance.annotations)).toHaveLength(0)
      expect(Object.values(customTypeInstance.annotations)).toHaveLength(0)
      expect(Object.values(fileInstance.annotations)).toHaveLength(0)
      expect(Object.values(folderInstance.annotations)).toHaveLength(0)
    })
  })
})
