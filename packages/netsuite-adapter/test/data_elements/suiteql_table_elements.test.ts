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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, TopLevelElement, isInstanceElement } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import NetsuiteClient from '../../src/client/client'
import { INTERNAL_IDS_MAP, QUERIES_BY_TABLE_NAME, SUITEQL_TABLE, getSuiteQLTableElements } from '../../src/data_elements/suiteql_table_elements'
import { SuiteQLTableName } from '../../src/data_elements/types'
import { NETSUITE } from '../../src/constants'
import { SERVER_TIME_TYPE_NAME } from '../../src/server_time'

const runSuiteQLMock = jest.fn()
const client = {
  runSuiteQL: runSuiteQLMock,
} as unknown as NetsuiteClient

describe('SuiteQL table elements', () => {
  let serverTimeType: ObjectType
  let serverTimeInstance: InstanceElement
  let suiteQLTableType: ObjectType
  let suiteQLTableInstance: InstanceElement
  let oldSuiteQLTableInstance: InstanceElement
  let emptySuiteQLTableInstance: InstanceElement
  let elements: TopLevelElement[]

  beforeEach(() => {
    jest.clearAllMocks()
    serverTimeType = new ObjectType({ elemID: new ElemID(NETSUITE, SERVER_TIME_TYPE_NAME) })
    serverTimeInstance = new InstanceElement(
      ElemID.CONFIG_NAME,
      serverTimeType,
      { serverTime: '2024-01-01T00:00:00.000Z' }
    )
    suiteQLTableType = new ObjectType({ elemID: new ElemID(NETSUITE, SUITEQL_TABLE) })
    suiteQLTableInstance = new InstanceElement(
      'currency',
      suiteQLTableType,
      {
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
        version: 1,
      }
    )
    oldSuiteQLTableInstance = new InstanceElement(
      'department',
      suiteQLTableType,
      {
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
        version: 'old',
      }
    )
    emptySuiteQLTableInstance = new InstanceElement(
      'subsidiary',
      suiteQLTableType,
      {
        version: 1,
      }
    )
  })

  describe('when there are no existing instances', () => {
    const numOfInstances = Object.values(QUERIES_BY_TABLE_NAME).filter(query => query !== undefined).length

    beforeEach(async () => {
      runSuiteQLMock.mockResolvedValue([
        { id: '1', name: 'Some name' },
        { id: '2', name: 'Some name 2' },
        { id: '3', name: 'Some name 3' },
      ])
      const elementsSource = buildElementsSourceFromElements([])
      elements = await getSuiteQLTableElements(client, elementsSource, false)
    })

    it('should return all elements', () => {
      expect(elements).toHaveLength(numOfInstances + 1)
      expect(elements.every(element => element.annotations[CORE_ANNOTATIONS.HIDDEN] === true)).toBeTruthy()
    })

    it('should set instance values correctly', () => {
      const instanceWithInternalIdsRecords = elements.filter(isInstanceElement)
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

    it('should not set values when name field do not match', () => {
      const instanceWithoutInternalIdsRecords = elements.filter(isInstanceElement)
        .find(element => QUERIES_BY_TABLE_NAME[element.elemID.name as SuiteQLTableName]?.nameField === 'title')
      expect(instanceWithoutInternalIdsRecords?.value).toEqual({
        [INTERNAL_IDS_MAP]: {},
        version: 1,
      })
    })
  })

  describe('when there are existing instances', () => {
    beforeEach(async () => {
      runSuiteQLMock.mockResolvedValue([
        { id: '1', name: 'Updated name' },
        { id: '4', name: 'New name 4' },
        { id: '5', name: 'New name 5' },
      ])
      const elementsSource = buildElementsSourceFromElements([
        serverTimeType,
        serverTimeInstance,
        suiteQLTableType,
        suiteQLTableInstance,
        oldSuiteQLTableInstance,
        emptySuiteQLTableInstance,
      ])
      elements = await getSuiteQLTableElements(client, elementsSource, false)
    })

    it('should update existing instance values', () => {
      const updatedInstance = elements.filter(isInstanceElement)
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
      const updatedInstance = elements.filter(isInstanceElement)
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
      const updatedInstance = elements.filter(isInstanceElement)
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
      expect(runSuiteQLMock).toHaveBeenCalledWith('SELECT id, name FROM currency WHERE lastmodifieddate >= TO_DATE(\'2024-1-1\', \'YYYY-MM-DD\') ORDER BY id ASC')
      // instance without latest version is called without lastmodifieddate
      expect(runSuiteQLMock).toHaveBeenCalledWith('SELECT id, name FROM department  ORDER BY id ASC')
      // empty instance with latest version is called with lastmodifieddate
      expect(runSuiteQLMock).toHaveBeenCalledWith('SELECT id, name FROM subsidiary WHERE lastmodifieddate >= TO_DATE(\'2024-1-1\', \'YYYY-MM-DD\') ORDER BY id ASC')
    })
  })

  describe('when isPartial=true', () => {
    beforeEach(async () => {
      runSuiteQLMock.mockResolvedValue([
        { id: '1', name: 'Some name' },
        { id: '2', name: 'Some name 2' },
        { id: '3', name: 'Some name 3' },
      ])
      const elementsSource = buildElementsSourceFromElements([
        suiteQLTableType,
        suiteQLTableInstance,
        oldSuiteQLTableInstance,
        emptySuiteQLTableInstance,
      ])
      elements = await getSuiteQLTableElements(client, elementsSource, true)
    })

    it('should return only existing instances', () => {
      expect(elements).toHaveLength(4)
      const existingInstance = elements.filter(isInstanceElement)
        .find(element => element.elemID.name === 'currency')
      expect(existingInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
        version: 1,
      })
      const oldExistingInstance = elements.filter(isInstanceElement)
        .find(element => element.elemID.name === 'department')
      expect(oldExistingInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {
          1: { name: 'Some name' },
          2: { name: 'Some name 2' },
          3: { name: 'Some name 3' },
        },
        version: 'old',
      })
      const emptyExistingInstance = elements.filter(isInstanceElement)
        .find(element => element.elemID.name === 'subsidiary')
      expect(emptyExistingInstance?.value).toEqual({
        [INTERNAL_IDS_MAP]: {},
        version: 1,
      })
    })

    it('should not call runSuiteQL', () => {
      expect(runSuiteQLMock).not.toHaveBeenCalled()
    })
  })
})
