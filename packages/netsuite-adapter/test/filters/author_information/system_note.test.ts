/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, Element, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import filterCreator, {
  FILE_FIELD_IDENTIFIER,
  FOLDER_FIELD_IDENTIFIER,
} from '../../../src/filters/author_information/system_note'
import { CUSTOM_RECORD_TYPE, EMPLOYEE, FILE, FOLDER, METADATA_TYPE, NETSUITE } from '../../../src/constants'
import { createServerTimeElements } from '../../../src/server_time'
import NetsuiteClient from '../../../src/client/client'
import { RemoteFilterOpts } from '../../../src/filter'
import SuiteAppClient from '../../../src/client/suiteapp_client/suiteapp_client'
import mockSdfClient from '../../client/sdf_client'
import { EMPLOYEE_NAME_QUERY } from '../../../src/filters/author_information/constants'
import { createEmptyElementsSourceIndexes, getDefaultAdapterConfig } from '../../utils'
import { toSuiteQLSelectDateString, toSuiteQLWhereDateString } from '../../../src/changes_detector/date_formats'
import { INTERNAL_IDS_MAP, SUITEQL_TABLE } from '../../../src/data_elements/suiteql_table_elements'
import { getTypesToInternalId } from '../../../src/data_elements/types'

describe('netsuite system note author information', () => {
  let filterOpts: RemoteFilterOpts
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
  const [serverTimeType, serverTimeInstance] = createServerTimeElements(new Date('2022-01-01'))
  const { internalIdToTypes, typeToInternalId } = getTypesToInternalId([])

  beforeEach(async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { recordid: '1', recordtypeid: '-112', field: '', name: '1', date: '2022-01-01 00:00:00' },
      // Should ignore this record because it has a date in the future
      { recordid: '1', recordtypeid: '-112', field: '', name: '1', date: '3022-03-01 00:00:00' },
      { recordid: '1', recordtypeid: '-123', field: '', name: '2', date: '2022-01-01 00:00:00' },
      { recordid: '2', recordtypeid: '-112', field: '', name: '3', date: '2022-01-01 00:00:00' },
      { recordid: '123', recordtypeid: '1', field: '', name: '3', date: '2022-01-01 00:00:00' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { recordid: '2', field: FOLDER_FIELD_IDENTIFIER, name: '3', date: '2022-01-01 00:00:00' },
      { recordid: '2', field: FILE_FIELD_IDENTIFIER, name: '3', date: '2022-01-01 00:00:00' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([
      { id: '1', entityid: 'user 1 name', date: '2022-01-01 00:00:00' },
      { id: '2', entityid: 'user 2 name', date: '2022-01-01 00:00:00' },
      { id: '3', entityid: 'user 3 name', date: '2022-01-01 00:00:00' },
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
    folderInstance = new InstanceElement(FOLDER, new ObjectType({ elemID: new ElemID(NETSUITE, FOLDER) }))
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
      internalIdToTypes,
      typeToInternalId,
    }
  })

  it('should query information from api', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    const recordTypeSystemNotesQuery = {
      select: 'name, recordid, recordtypeid, date',
      from: `(SELECT name, recordid, recordtypeid, ${toSuiteQLSelectDateString('MAX(date)')} as date FROM systemnote WHERE date >= ${toSuiteQLWhereDateString(new Date('2022-01-01'))} AND recordtypeid IN (-112, 1, -123, -125) GROUP BY name, recordid, recordtypeid)`,
      orderBy: 'name, recordid, recordtypeid',
    }

    const fieldSystemNotesQuery = {
      select: `name, field, recordid, ${toSuiteQLSelectDateString('MAX(date)')} AS date`,
      from: 'systemnote',
      where:
        "date >= TO_DATE('2022-1-1', 'YYYY-MM-DD') AND (field LIKE 'MEDIAITEM.%' OR field LIKE 'MEDIAITEMFOLDER.%')",
      groupBy: 'name, field, recordid',
      orderBy: 'name, field, recordid',
    }

    expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, fieldSystemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, recordTypeSystemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(3, EMPLOYEE_NAME_QUERY)
    expect(runSuiteQLMock).toHaveBeenCalledTimes(3)
  })

  it('should query information from api when there are no files', async () => {
    await filterCreator(filterOpts).onFetch?.([
      accountInstance,
      customRecordType,
      customRecord,
      customRecordTypeWithNoInstances,
      missingInstance,
    ])
    const systemNotesQuery = {
      select: 'name, recordid, recordtypeid, date',
      from: `(SELECT name, recordid, recordtypeid, ${toSuiteQLSelectDateString('MAX(date)')} as date FROM systemnote WHERE date >= ${toSuiteQLWhereDateString(new Date('2022-01-01'))} AND recordtypeid IN (-112, 1, -123, -125) GROUP BY name, recordid, recordtypeid)`,
      orderBy: 'name, recordid, recordtypeid',
    }
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(1, systemNotesQuery)
    expect(runSuiteQLMock).toHaveBeenNthCalledWith(2, EMPLOYEE_NAME_QUERY)
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
    expect(missingInstance.annotations).toEqual({})
    expect(fileInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
    expect(folderInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
  })

  it('should use employee SuiteQLTable instance to get employee names', async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValue([
      { recordid: '1', recordtypeid: '-112', field: '', name: '1', date: '2022-01-01 00:00:00' },
      { recordid: '1', recordtypeid: '-123', field: '', name: '2', date: '2022-01-01 00:00:00' },
      { recordid: '123', recordtypeid: '1', field: '', name: '3', date: '2022-01-01 00:00:00' },
    ])
    const suiteQLTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })
    const employeeSuiteQLTableInstance = new InstanceElement(EMPLOYEE, suiteQLTableType, {
      [INTERNAL_IDS_MAP]: {
        1: { name: 'user 1 name' },
        2: { name: 'user 2 name' },
        3: { name: 'user 3 name' },
      },
    })
    await filterCreator(filterOpts).onFetch?.(elements.concat(suiteQLTableType, employeeSuiteQLTableInstance))
    expect(runSuiteQLMock).not.toHaveBeenCalledWith(EMPLOYEE_NAME_QUERY)
    expect(accountInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 1 name').toBeTruthy()
    expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 2 name').toBeTruthy()
    expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
  })

  it('should query missing employee names in SuiteQLTable instance', async () => {
    runSuiteQLMock.mockReset()
    runSuiteQLMock.mockResolvedValueOnce([
      { recordid: '1', recordtypeid: '-112', field: '', name: '1', date: '2022-01-01 00:00:00' },
      { recordid: '1', recordtypeid: '-123', field: '', name: '2', date: '2022-01-01 00:00:00' },
      { recordid: '123', recordtypeid: '1', field: '', name: '3', date: '2022-01-01 00:00:00' },
    ])
    runSuiteQLMock.mockResolvedValueOnce([])
    runSuiteQLMock.mockResolvedValueOnce([{ id: '3', entityid: 'user 3 name', date: '2022-01-01 00:00:00' }])
    const suiteQLTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })
    const employeeSuiteQLTableInstance = new InstanceElement(EMPLOYEE, suiteQLTableType, {
      [INTERNAL_IDS_MAP]: {
        1: { name: 'user 1 name' },
        2: { name: 'user 2 name' },
      },
    })
    await filterCreator(filterOpts).onFetch?.(elements.concat(suiteQLTableType, employeeSuiteQLTableInstance))
    expect(runSuiteQLMock).toHaveBeenCalledWith({ ...EMPLOYEE_NAME_QUERY, where: "id in ('3')" })
    expect(accountInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 1 name').toBeTruthy()
    expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 2 name').toBeTruthy()
    expect(customRecord.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'user 3 name').toBeTruthy()
  })

  it('should add dates to elements', async () => {
    await filterCreator(filterOpts).onFetch?.(elements)
    expect(accountInstance.annotations[CORE_ANNOTATIONS.CHANGED_AT]).toEqual('2022-01-01T00:00:00Z')
    expect(customRecordType.annotations[CORE_ANNOTATIONS.CHANGED_AT] === '2022-01-01T00:00:00Z').toBeTruthy()
    expect(missingInstance.annotations).toEqual({})
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
        getIndexes: () =>
          Promise.resolve({
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
      internalIdToTypes,
      typeToInternalId,
    }
    await filterCreator(opts).onFetch?.(elements)
    expect(missingInstance.annotations[CORE_ANNOTATIONS.CHANGED_BY] === 'another user name').toBeTruthy()
  })

  it('should use elemIdToChangeAtIndex to get the change date if there is no new change information', async () => {
    runSuiteQLMock.mockReset()
    const opts = {
      client,
      elementsSourceIndex: {
        getIndexes: () =>
          Promise.resolve({
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
      internalIdToTypes,
      typeToInternalId,
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
      await filterCreator(filterOpts).onFetch?.(elements)
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
      await filterCreator(filterOpts).onFetch?.(elements)
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
      await filterCreator(filterOpts).onFetch?.(elements)
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
        internalIdToTypes,
        typeToInternalId,
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
        internalIdToTypes,
        typeToInternalId,
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
        internalIdToTypes,
        typeToInternalId,
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
