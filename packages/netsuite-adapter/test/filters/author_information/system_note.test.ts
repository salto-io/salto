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
import { CORE_ANNOTATIONS, Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator, { FILE_FIELD_IDENTIFIER, FOLDER_FIELD_IDENTIFIER, QUERY_DATE_FORMAT } from '../../../src/filters/author_information/system_note'
import { CUSTOM_RECORD_TYPE, FILE, FOLDER, METADATA_TYPE, NETSUITE } from '../../../src/constants'
import { createServerTimeElements } from '../../../src/server_time'
import NetsuiteClient from '../../../src/client/client'
import { FilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'
import { EMPLOYEE_NAME_QUERY } from '../../../src/filters/author_information/constants'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../../utils'

describe('netsuite system note author information', () => {
  let filterOpts: FilterOpts
  let elements: Element[]
  let fileInstance: InstanceElement
  let folderInstance: InstanceElement
  let accountInstance: InstanceElement
  let customRecordType: ObjectType
  let customRecord: InstanceElement
  let customRecordTypeWithNoInstances: ObjectType
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
  const { type: serverTimeType, instance: serverTimeInstance } = createServerTimeElements(new Date('2022-01-01'))

  beforeEach(async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { id: '1', entityid: 'user 1 name', date: '2022-01-01' },
      { id: '2', entityid: 'user 2 name', date: '2022-01-01' },
      { id: '3', entityid: 'user 3 name', date: '2022-01-01' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { recordid: '1', recordtypeid: '-112', field: '', name: '1', date: '2022-01-01' },
      // Should ignore this record because it has a date in the future
      { recordid: '1', recordtypeid: '-112', field: '', name: '1', date: '3022-03-01' },
      { recordid: '1', recordtypeid: '-123', field: '', name: '2', date: '2022-01-01' },
      { recordid: '2', recordtypeid: '-112', field: '', name: '3', date: '2022-01-01' },
      { recordid: '123', recordtypeid: '1', field: '', name: '3', date: '2022-01-01' },
      { recordid: '2', field: FOLDER_FIELD_IDENTIFIER, name: '3', date: '2022-01-01' },
      { recordid: '2', field: FILE_FIELD_IDENTIFIER, name: '3', date: '2022-01-01' },
    ])
    accountInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    accountInstance.value.internalId = '1'
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE },
    })
    customRecordType.annotations.internalId = '1'
    customRecord = new InstanceElement('value_123', customRecordType, { internalId: '123' })
    customRecordTypeWithNoInstances = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord2'),
      annotations: { [METADATA_TYPE]: CUSTOM_RECORD_TYPE },
    })
    customRecordTypeWithNoInstances.annotations.internalId = '2'
    fileInstance = new InstanceElement(FILE, new ObjectType({ elemID: new ElemID(NETSUITE, FILE) }))
    fileInstance.value.internalId = '2'
    folderInstance = new InstanceElement(
      FOLDER, new ObjectType({ elemID: new ElemID(NETSUITE, FOLDER) })
    )
    folderInstance.value.internalId = '2'
    missingInstance = new InstanceElement('account', new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }))
    missingInstance.value.internalId = '8'
    elements = [
      accountInstance,
      customRecordType,
      customRecord,
      customRecordTypeWithNoInstances,
      missingInstance,
      fileInstance,
      folderInstance,
    ]
    filterOpts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve(createEmptyElementsSourceIndexes()),
      },
      elementsSource: buildElementsSourceFromElements([serverTimeType, serverTimeInstance]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
  })

  it('should query information from api', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    const fieldSystemNotesQuery = `SELECT name, field, recordid, date from (SELECT name, field, recordid, TO_CHAR(MAX(date), '${QUERY_DATE_FORMAT}') AS date FROM (SELECT name, REGEXP_SUBSTR(field, '^(MEDIAITEMFOLDER.|MEDIAITEM.)') AS field, recordid, date FROM systemnote WHERE date >= TO_DATE('2022-01-01', '${QUERY_DATE_FORMAT}') AND (field LIKE 'MEDIAITEM.%' OR field LIKE 'MEDIAITEMFOLDER.%')) GROUP BY name, field, recordid) ORDER BY name, field, recordid ASC`
    const recordTypeSystemNotesQuery = `SELECT name, recordid, recordtypeid, date FROM (SELECT name, recordid, recordtypeid, TO_CHAR(MAX(date), '${QUERY_DATE_FORMAT}') as date FROM systemnote WHERE date >= TO_DATE('2022-01-01', '${QUERY_DATE_FORMAT}') AND (recordtypeid = '-112' OR recordtypeid = '1' OR recordtypeid = '-123') GROUP BY name, recordid, recordtypeid) ORDER BY name, recordid, recordtypeid ASC`
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, EMPLOYEE_NAME_QUERY)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, fieldSystemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(3, recordTypeSystemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenCalledTimes(3)
  })

  it('should query information from api when there are no files', async () => {
    await filterCreator(filterOpts).onFetch?.(
      [accountInstance, customRecordType, customRecord, customRecordTypeWithNoInstances, missingInstance]
    )
    const systemNotesQuery = `SELECT name, recordid, recordtypeid, date FROM (SELECT name, recordid, recordtypeid, TO_CHAR(MAX(date), '${QUERY_DATE_FORMAT}') as date FROM systemnote WHERE date >= TO_DATE('2022-01-01', '${QUERY_DATE_FORMAT}') AND (recordtypeid = '-112' OR recordtypeid = '1' OR recordtypeid = '-123') GROUP BY name, recordid, recordtypeid) ORDER BY name, recordid, recordtypeid ASC`
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
    expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 2 name').toBeTruthy()
    expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
    expect(Object.values(missingInstance.annotations)).toHaveLength(0)
    expect(fileInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
    expect(folderInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
  })

  it('should add dates to elements', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(accountInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('2022-01-01T00:00:00Z')
    expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_AT] === '2022-01-01T00:00:00Z').toBeTruthy()
    expect(Object.values(missingInstance.annotations)).toHaveLength(0)
    expect(fileInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT] === '2022-01-01T00:00:00Z').toBeTruthy()
    expect(folderInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT] === '2022-01-01T00:00:00Z').toBeTruthy()
  })

  it('elements will stay the same if there is no author information', async () => {
    runSuiteQLMock.mockReset()
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(Object.values(accountInstance.annotations)).toHaveLength(0)
    expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
    expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
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
          elemIdToChangeAtIndex: {
            [missingInstance.elemID.getFullName()]: '2022-08-19',
          },
        }),
      },
      elementsSource: buildElementsSourceFromElements([serverTimeType, serverTimeInstance]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
    await filterCreator(opts).onFetch?.(elements)
    expect(missingInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'another user name').toBeTruthy()
  })

  it('should use elemIdToChangeAtIndex to get the change date if there is no new change information', async () => {
    runSuiteQLMock.mockReset()
    const opts = {
      client,
      elementsSourceIndex: {
        getIndexes: () => Promise.resolve({
          ...createEmptyElementsSourceIndexes(),
          elemIdToChangeByIndex: {
            [missingInstance.elemID.getFullName()]: 'another user name',
          },
          elemIdToChangeAtIndex: {
            [missingInstance.elemID.getFullName()]: '8/19/2022',
          },
        }),
      },
      elementsSource: buildElementsSourceFromElements([serverTimeType, serverTimeInstance]),
      isPartial: false,
      config: await getDefaultAdapterConfig(),
    }
    await filterCreator(opts).onFetch?.(elements)
    expect(missingInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('8/19/2022')
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
      expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
      expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
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
      expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
      expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
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
      runSuiteQLMock.mockReset()
      await filterCreator(filterOpts).onFetch?.(elements)
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(Object.values(accountInstance.annotations)).toHaveLength(0)
      expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
      expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
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
      expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
      expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
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
      expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
      expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY]).toBeUndefined()
      expect(Object.values(fileInstance.annotations)).toHaveLength(0)
      expect(Object.values(folderInstance.annotations)).toHaveLength(0)
    })
  })
})
