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
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  TopLevelElement,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import NetsuiteClient from '../../src/client/client'
import {
  INTERNAL_IDS_MAP,
  QUERIES_BY_TABLE_NAME,
  SUITEQL_TABLE,
  getSuiteQLTableElements,
} from '../../src/data_elements/suiteql_table_elements'
import { SuiteQLTableName } from '../../src/data_elements/types'
import { ALLOCATION_TYPE, NETSUITE, PROJECT_EXPENSE_TYPE, TAX_SCHEDULE } from '../../src/constants'
import { SERVER_TIME_TYPE_NAME } from '../../src/server_time'
import { NetsuiteConfig } from '../../src/config/types'
import { fullFetchConfig } from '../../src/config/config_creator'

export const NUM_OF_SUITEQL_ELEMENTS =
  Object.values(QUERIES_BY_TABLE_NAME).filter(query => query !== undefined).length +
  // additional elements are the type, and instances from getAdditionalInstances
  4

const TYPE_TO_SKIP = 'vendor'
const TYPE_WITH_MAX_RESULTS = 'unitsType'
const TYPE_WITH_ALLOWED_MAX_RESULTS = 'term'

const runSuiteQLMock = jest.fn()
const runSavedSearchQueryMock = jest.fn()
const client = {
  runSuiteQL: runSuiteQLMock,
  runSavedSearchQuery: runSavedSearchQueryMock,
  isSuiteAppConfigured: () => true,
} as unknown as NetsuiteClient

describe('SuiteQL table elements', () => {
  let config: NetsuiteConfig
  let serverTimeType: ObjectType
  let serverTimeInstance: InstanceElement
  let suiteQLTableType: ObjectType
  let suiteQLTableInstance: InstanceElement
  let oldSuiteQLTableInstance: InstanceElement
  let emptySuiteQLTableInstance: InstanceElement
  let result: { elements: TopLevelElement[]; largeSuiteQLTables: string[] }

  beforeEach(() => {
    jest.clearAllMocks()
    config = {
      fetch: {
        ...fullFetchConfig(),
        resolveAccountSpecificValues: true,
        skipResolvingAccountSpecificValuesToTypes: [TYPE_TO_SKIP],
      },
      suiteAppClient: {
        maxRecordsPerSuiteQLTable: [{ name: TYPE_WITH_ALLOWED_MAX_RESULTS, limit: 300_000 }],
      },
    }
    serverTimeType = new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) })
    serverTimeInstance = new InstanceElement(ElemID.CONFIG_NAME, serverTimeType, {
      serverTime: '2024-01-01T00:00:00.000Z',
    })
    suiteQLTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })
    suiteQLTableInstance = new InstanceElement('currency', suiteQLTableType, {
      [INTERNAL_IDS_MAP]: {
        1: { name: 'Some name' },
        2: { name: 'Some name 2' },
        3: { name: 'Some name 3' },
      },
      version: 1,
    })
    oldSuiteQLTableInstance = new InstanceElement('department', suiteQLTableType, {
      [INTERNAL_IDS_MAP]: {
        1: { name: 'Some name' },
        2: { name: 'Some name 2' },
        3: { name: 'Some name 3' },
      },
      version: 'old',
    })
    emptySuiteQLTableInstance = new InstanceElement('subsidiary', suiteQLTableType, {
      version: 1,
    })
  })

  describe('when there are no existing instances', () => {
    beforeEach(async () => {
      runSuiteQLMock.mockImplementation(query =>
        query.includes('count(*)')
          ? [
              {
                count:
                  query.includes(`FROM ${TYPE_WITH_MAX_RESULTS} `) ||
                  query.includes(`FROM ${TYPE_WITH_ALLOWED_MAX_RESULTS} `)
                    ? '200000'
                    : '3',
              },
            ]
          : [
              { id: '1', name: 'Some name' },
              { id: '2', name: 'Some name 2' },
              { id: '3', name: 'Some name 3' },
            ],
      )
      runSavedSearchQueryMock.mockImplementation(({ type, filters }) => {
        if (type !== 'resourceAllocation') {
          return [
            { internalid: [{ value: '1' }], name: 'Tax Schedule 1' },
            { internalid: [{ value: '2' }], name: 'Tax Schedule 2' },
            { internalid: [{ value: '3' }], name: 'Tax Schedule 3' },
          ]
        }
        if (filters.length === 0) {
          return _.range(50).map(_i => ({
            allocationType: [
              {
                value: '1',
                text: 'Allocation Type 1',
              },
            ],
          }))
        }
        return [
          {
            allocationType: [
              {
                value: '2',
                text: 'Allocation Type 2',
              },
            ],
          },
        ]
      })
      const elementsSource = buildElementsSourceFromElements([])
      result = await getSuiteQLTableElements(config, client, elementsSource, false)
    })

    it('should return all elements', () => {
      // minus 2 for the skipped table (TYPE_TO_SKIP) and the table with too many records (TYPE_WITH_MAX_RESULTS)
      expect(result.elements).toHaveLength(NUM_OF_SUITEQL_ELEMENTS - 2)
      expect(result.elements.every(element => element.annotations[CORE_ANNOTATIONS.HIDDEN] === true)).toBeTruthy()
    })

    it('should set instance values correctly', () => {
      const instanceWithInternalIdsRecords = result.elements
        .filter(isInstanceElement)
        .find(element => QUERIES_BY_TABLE_NAME[element.elemID.name as SuiteQLTableName]?.nameField === 'name')
      expect(instanceWithInternalIdsRecords?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
        version: 1,
      })
    })

    it('should set tax schedule instance values correctly', () => {
      const taxScheduleInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === TAX_SCHEDULE)
      expect(taxScheduleInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Tax Schedule 1' },
          2: { name: 'Tax Schedule 2' },
          3: { name: 'Tax Schedule 3' },
        },
        version: 1,
      })
    })

    it('should set allocation type instance values correctly', () => {
      const allocationTypeInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === ALLOCATION_TYPE)
      expect(allocationTypeInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Allocation Type 1' },
          2: { name: 'Allocation Type 2' },
        },
        version: 1,
      })
    })

    it('should call runSavedSearch with right params', () => {
      expect(runSavedSearchQueryMock).toHaveBeenCalledTimes(4)
      expect(runSavedSearchQueryMock).toHaveBeenCalledWith({
        type: TAX_SCHEDULE,
        columns: ['internalid', 'name'],
        filters: [],
      })
      expect(runSavedSearchQueryMock).toHaveBeenCalledWith({
        type: PROJECT_EXPENSE_TYPE,
        columns: ['internalid', 'name'],
        filters: [],
      })
      expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
        {
          type: 'resourceAllocation',
          columns: [ALLOCATION_TYPE],
          filters: [],
        },
        50,
      )
      expect(runSavedSearchQueryMock).toHaveBeenCalledWith(
        {
          type: 'resourceAllocation',
          columns: [ALLOCATION_TYPE],
          filters: [[ALLOCATION_TYPE, 'noneof', '1']],
        },
        50,
      )
    })

    it('should not set values when name field do not match', () => {
      const instanceWithoutInternalIdsRecords = result.elements
        .filter(isInstanceElement)
        .find(element => QUERIES_BY_TABLE_NAME[element.elemID.name as SuiteQLTableName]?.nameField === 'title')
      expect(instanceWithoutInternalIdsRecords?.value).toEqual({
        [INTERNAL_IDS_MAP]: {},
        version: 1,
      })
    })

    it('should skip tables from skipResolvingAccountSpecificValuesToTypes', () => {
      expect(result.elements.find(elem => elem.elemID.name === TYPE_TO_SKIP)).toBeUndefined()
      expect(runSuiteQLMock).not.toHaveBeenCalledWith(expect.stringContaining(`FROM ${TYPE_TO_SKIP} `))
    })

    it('should skip tables that reach the records limitation', () => {
      const query = QUERIES_BY_TABLE_NAME[TYPE_WITH_MAX_RESULTS]
      expect(result.largeSuiteQLTables).toEqual([TYPE_WITH_MAX_RESULTS])
      expect(result.elements.find(elem => elem.elemID.name === TYPE_WITH_MAX_RESULTS)).toBeUndefined()
      expect(runSuiteQLMock).not.toHaveBeenCalledWith(
        expect.stringContaining(`SELECT ${query?.internalIdField}, ${query?.nameField} FROM ${TYPE_WITH_MAX_RESULTS} `),
      )
    })

    it('should not skip tables with configured records limitation', () => {
      const query = QUERIES_BY_TABLE_NAME[TYPE_WITH_ALLOWED_MAX_RESULTS]
      expect(result.elements.find(elem => elem.elemID.name === TYPE_WITH_ALLOWED_MAX_RESULTS)).toBeDefined()
      expect(runSuiteQLMock).toHaveBeenCalledWith(
        expect.stringContaining(
          `SELECT ${query?.internalIdField}, ${query?.nameField} FROM ${TYPE_WITH_ALLOWED_MAX_RESULTS} `,
        ),
      )
    })
  })

  describe('when there are existing instances', () => {
    beforeEach(async () => {
      runSuiteQLMock.mockImplementation(query =>
        query.includes('count(*)')
          ? [{ count: '3' }]
          : [
              { id: '1', name: 'Updated name' },
              { id: '4', name: 'New name 4' },
              { id: '5', name: 'New name 5' },
            ],
      )
      const elementsSource = buildElementsSourceFromElements([
        serverTimeType,
        serverTimeInstance,
        suiteQLTableType,
        suiteQLTableInstance,
        oldSuiteQLTableInstance,
        emptySuiteQLTableInstance,
      ])
      result = await getSuiteQLTableElements(config, client, elementsSource, false)
    })

    it('should update existing instance values', () => {
      const updatedInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === 'currency')
      expect(updatedInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Updated name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
          4: { name: 'New name 4' },
          5: { name: 'New name 5' },
        },
        version: 1,
      })
    })

    it('should override existing values when instance version is not latest version', () => {
      const updatedInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === 'department')
      expect(updatedInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Updated name' },
          4: { name: 'New name 4' },
          5: { name: 'New name 5' },
        },
        version: 1,
      })
    })

    it('should add values to empty instance', () => {
      const updatedInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === 'subsidiary')
      expect(updatedInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Updated name' },
          4: { name: 'New name 4' },
          5: { name: 'New name 5' },
        },
        version: 1,
      })
    })

    it('should call runSuiteQL with right queries', () => {
      // instance with latest version is called with lastmodifieddate
      expect(runSuiteQLMock).toHaveBeenCalledWith(
        "SELECT id, name FROM currency WHERE lastmodifieddate >= TO_DATE('2024-1-1', 'YYYY-MM-DD') ORDER BY id ASC",
      )
      // instance without latest version is called without lastmodifieddate
      expect(runSuiteQLMock).toHaveBeenCalledWith('SELECT id, name FROM department  ORDER BY id ASC')
      // empty instance with latest version is called with lastmodifieddate
      expect(runSuiteQLMock).toHaveBeenCalledWith(
        "SELECT id, name FROM subsidiary WHERE lastmodifieddate >= TO_DATE('2024-1-1', 'YYYY-MM-DD') ORDER BY id ASC",
      )
    })
  })

  describe('when isPartial=true', () => {
    beforeEach(async () => {
      runSuiteQLMock.mockImplementation(query =>
        query.includes('count(*)')
          ? [{ count: '3' }]
          : [
              { id: '1', entityid: 'Some name' },
              { id: '2', entityid: 'Some name 2' },
              { id: '3', entityid: 'Some name 3' },
            ],
      )
      const elementsSource = buildElementsSourceFromElements([
        suiteQLTableType,
        suiteQLTableInstance,
        oldSuiteQLTableInstance,
        emptySuiteQLTableInstance,
      ])
      result = await getSuiteQLTableElements(config, client, elementsSource, true)
    })

    it('should return only existing instances and employee instance', () => {
      expect(result.elements).toHaveLength(5)
      const existingInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === 'currency')
      expect(existingInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
        version: 1,
      })
      const oldExistingInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === 'department')
      expect(oldExistingInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
        version: 'old',
      })
      const emptyExistingInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === 'subsidiary')
      expect(emptyExistingInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {},
        version: 1,
      })
      const employeeInstance = result.elements
        .filter(isInstanceElement)
        .find(element => element.elemID.name === 'employee')
      expect(employeeInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
        version: 1,
      })
    })

    it('should not call runSuiteQL', () => {
      expect(runSuiteQLMock).toHaveBeenCalledTimes(1)
      expect(runSuiteQLMock).toHaveBeenCalledWith(expect.stringContaining('FROM employee'))
    })
  })

  describe('when fetch.resolveAccountSpecificValues=false', () => {
    beforeEach(async () => {
      config.fetch.resolveAccountSpecificValues = false
      const elementsSource = buildElementsSourceFromElements([])
      result = await getSuiteQLTableElements(config, client, elementsSource, false)
    })
    it('should not return elements', () => {
      expect(result.elements).toHaveLength(0)
    })
    it('should not run queries', () => {
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
    })
  })

  describe('when fetch.skipResolvingAccountSpecificValuesToTypes=[".*"]', () => {
    beforeEach(async () => {
      config.fetch.skipResolvingAccountSpecificValuesToTypes = ['.*']
      const elementsSource = buildElementsSourceFromElements([])
      result = await getSuiteQLTableElements(config, client, elementsSource, false)
    })
    it('should not return elements', () => {
      expect(result.elements).toHaveLength(1)
      expect(result.elements[0].elemID).toEqual(suiteQLTableType.elemID)
    })
    it('should not run queries', () => {
      expect(runSuiteQLMock).not.toHaveBeenCalled()
      expect(runSavedSearchQueryMock).not.toHaveBeenCalled()
    })
  })
})
