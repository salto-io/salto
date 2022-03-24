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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import SdfClient from '../../src/client/sdf_client'
import * as suiteAppFileCabinet from '../../src/suiteapp_file_cabinet'
import NetsuiteClient from '../../src/client/client'
import { SUITEAPP_CREATING_RECORDS_GROUP_ID, SUITEAPP_DELETING_RECORDS_GROUP_ID, SUITEAPP_UPDATING_CONFIG_GROUP_ID, SUITEAPP_UPDATING_RECORDS_GROUP_ID } from '../../src/group_changes'
import { NETSUITE } from '../../src/constants'
import { SetConfigType } from '../../src/client/suiteapp_client/types'
import { SUITEAPP_CONFIG_RECORD_TYPES, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../src/types'
import { NetsuiteQuery } from '../../src/query'

describe('NetsuiteClient', () => {
  const sdfClient = {
    getCredentials: () => ({ accountId: 'someId' }),
  } as unknown as SdfClient

  const updateInstancesMock = jest.fn()
  const addInstancesMock = jest.fn()
  const deleteInstancesMock = jest.fn()
  const getConfigRecordsMock = jest.fn()
  const setConfigRecordsValuesMock = jest.fn()

  const suiteAppClient = {
    updateInstances: updateInstancesMock,
    addInstances: addInstancesMock,
    deleteInstances: deleteInstancesMock,
    getConfigRecords: getConfigRecordsMock,
    setConfigRecordsValues: setConfigRecordsValuesMock,
  } as unknown as SuiteAppClient

  const getPathToIdMapMock = jest.fn()
  jest.spyOn(suiteAppFileCabinet, 'createSuiteAppFileCabinetOperations').mockReturnValue({
    getPathToIdMap: getPathToIdMapMock,
  } as unknown as suiteAppFileCabinet.SuiteAppFileCabinetOperations)

  const client = new NetsuiteClient(sdfClient, suiteAppClient)

  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('getPathInternalId', () => {
    it('should return the right id', async () => {
      getPathToIdMapMock.mockResolvedValue({ '/some/path': 1 })
      expect(await client.getPathInternalId('/some/path')).toBe(1)
      expect(await client.getPathInternalId('/some/path2')).toBeUndefined()
    })

    it('should return undefined when failed to get map', async () => {
      getPathToIdMapMock.mockResolvedValue(undefined)
      expect(await client.getPathInternalId('/some/path1')).toBeUndefined()
    })
  })

  describe('getConfigElements', () => {
    it('should return type and instance', async () => {
      const fetchQuery = {
        isTypeMatch: jest.fn().mockResolvedValue(true),
      } as unknown as NetsuiteQuery
      getConfigRecordsMock.mockResolvedValue([{
        configType: SUITEAPP_CONFIG_RECORD_TYPES[0],
        fieldsDef: [{ id: 'field', label: 'field', type: 'checkbox', selectOptions: [] }],
        data: { fields: { field: 'T' } },
      }])
      const elements = await client.getConfigElements(fetchQuery)
      // selectOptionType + configType + configInstance
      expect(elements.length).toEqual(3)
    })
  })

  describe('deploy', () => {
    const type = new ObjectType({
      elemID: new ElemID(NETSUITE, 'subsidiary'),
    })
    const instance1 = new InstanceElement(
      'instance1',
      type,
    )

    const instance2 = new InstanceElement(
      'instance2',
      type,
    )
    const change1 = toChange({ before: instance1, after: instance1 })
    const change2 = toChange({ before: instance2, after: instance2 })
    it('should return error if suiteApp is not installed', async () => {
      const clientWithoutSuiteApp = new NetsuiteClient(sdfClient)
      expect(await clientWithoutSuiteApp.deploy(
        [change1, change2],
        SUITEAPP_UPDATING_RECORDS_GROUP_ID,
        false,
      )).toEqual({
        errors: [new Error(`Salto SuiteApp is not configured and therefore changes group "${SUITEAPP_UPDATING_RECORDS_GROUP_ID}" cannot be deployed`)],
        elemIdToInternalId: {},
        appliedChanges: [],
      })
      expect(await clientWithoutSuiteApp.deploy(
        [change1, change2],
        SUITEAPP_UPDATING_CONFIG_GROUP_ID,
        false,
      )).toEqual({
        errors: [new Error(`Salto SuiteApp is not configured and therefore changes group "${SUITEAPP_UPDATING_CONFIG_GROUP_ID}" cannot be deployed`)],
        appliedChanges: [],
      })
    })
    it('should use updateInstances for data instances modifications', async () => {
      updateInstancesMock.mockResolvedValue([1, new Error('error')])
      const results = await client.deploy(
        [change1, change2],
        SUITEAPP_UPDATING_RECORDS_GROUP_ID,
        false,
      )
      expect(results.appliedChanges).toEqual([change1])
      expect(results.errors).toEqual([new Error('error')])
      expect(results.elemIdToInternalId).toEqual({ [instance1.elemID.getFullName()]: '1' })
    })

    it('should use addInstances for data instances creations', async () => {
      addInstancesMock.mockResolvedValue([1, new Error('error')])
      const results = await client.deploy(
        [
          toChange({ after: instance1 }),
          toChange({ after: instance2 }),
        ],
        SUITEAPP_CREATING_RECORDS_GROUP_ID,
        false,
      )
      expect(results.appliedChanges).toEqual([toChange({ after: instance1 })])
      expect(results.errors).toEqual([new Error('error')])
      expect(results.elemIdToInternalId).toEqual({ [instance1.elemID.getFullName()]: '1' })
    })

    it('should use deleteInstances for data instances deletions', async () => {
      deleteInstancesMock.mockResolvedValue([1, new Error('error')])
      const results = await client.deploy(
        [
          toChange({ before: instance1 }),
          toChange({ before: instance2 }),
        ],
        SUITEAPP_DELETING_RECORDS_GROUP_ID,
        false,
      )
      expect(results.appliedChanges).toEqual([toChange({ before: instance1 })])
      expect(results.errors).toEqual([new Error('error')])
    })

    it('should use deployConfigChanges for config instances', async () => {
      setConfigRecordsValuesMock.mockImplementation(types =>
        types.map(({ configType }: SetConfigType) => ({ configType, status: 'success' })))

      const configType = SUITEAPP_CONFIG_RECORD_TYPES[0]
      const configObjectType = new ObjectType({
        elemID: new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType]),
      })

      const results = await client.deploy(
        [
          toChange({
            before: new InstanceElement(
              ElemID.CONFIG_NAME,
              configObjectType,
              { configType, field: true }
            ),
            after: new InstanceElement(
              ElemID.CONFIG_NAME,
              configObjectType,
              { configType, field: false }
            ),
          }),
        ],
        SUITEAPP_UPDATING_CONFIG_GROUP_ID,
        false,
      )
      expect(results.appliedChanges.length).toEqual(1)
      expect(results.errors.length).toEqual(0)
    })
  })
})
