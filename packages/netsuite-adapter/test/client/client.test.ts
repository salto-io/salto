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
import { ElemID, InstanceElement, ObjectType, toChange, Change, BuiltinTypes } from '@salto-io/adapter-api'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import SdfClient from '../../src/client/sdf_client'
import * as suiteAppFileCabinet from '../../src/suiteapp_file_cabinet'
import NetsuiteClient from '../../src/client/client'
import { SDF_CHANGE_GROUP_ID, SUITEAPP_CREATING_RECORDS_GROUP_ID, SUITEAPP_DELETING_RECORDS_GROUP_ID, SUITEAPP_UPDATING_CONFIG_GROUP_ID, SUITEAPP_UPDATING_RECORDS_GROUP_ID } from '../../src/group_changes'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { SetConfigType } from '../../src/client/suiteapp_client/types'
import { SUITEAPP_CONFIG_RECORD_TYPES, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../src/types'
import { featuresType } from '../../src/types/configuration_types'
import { FeaturesDeployError, ObjectsDeployError, SettingsDeployError } from '../../src/errors'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { AdditionalDependencies } from '../../src/client/types'

describe('NetsuiteClient', () => {
  describe('with SDF client', () => {
    const mockSdfDeploy = jest.fn()
    const sdfClient = {
      getCredentials: () => ({ accountId: 'someId' }),
      deploy: mockSdfDeploy,
    } as unknown as SdfClient
    const mockElementsSourceIndex = jest.fn() as unknown as LazyElementsSourceIndexes
    const client = new NetsuiteClient(sdfClient)

    const deployParams: [boolean, AdditionalDependencies, LazyElementsSourceIndexes] = [
      false,
      {
        include: { features: [], objects: [] },
        exclude: { features: [], objects: [] },
      },
      mockElementsSourceIndex,
    ]
    describe('deploy', () => {
      beforeEach(() => {
        jest.resetAllMocks()
      })

      it('should try again to deploy after ObjectsDeployError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const objectsDeployError = new ObjectsDeployError('error', new Set(['failedObject']))
        mockSdfDeploy.mockRejectedValueOnce(objectsDeployError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'failedObject' }),
        })
        expect(await client.deploy(
          [successChange, failedChange],
          SDF_CHANGE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [objectsDeployError],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })
      it('should fail when failed changes couldn\'t be found in ObjectsDeployError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const objectsDeployError = new ObjectsDeployError('error', new Set(['unknownObject']))
        mockSdfDeploy.mockRejectedValueOnce(objectsDeployError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'failedObject' }),
        })
        expect(await client.deploy(
          [successChange, failedChange],
          SDF_CHANGE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [objectsDeployError],
          appliedChanges: [],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(1)
      })
      it('should try again to deploy after SettingsDeployError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const settingsType = new ObjectType({ elemID: new ElemID(NETSUITE, 'settingsType') })
        const settingsDeployError = new SettingsDeployError('error', new Set(['settingsType']))
        mockSdfDeploy.mockRejectedValueOnce(settingsDeployError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        const failedChange = toChange({
          after: new InstanceElement(ElemID.CONFIG_NAME, settingsType),
        })
        expect(await client.deploy(
          [successChange, failedChange],
          SDF_CHANGE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [settingsDeployError],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })
      it('should not try again to deploy if SettingsDeployError doesn\'t contain an actual failing change', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const settingsDeployError = new SettingsDeployError('error', new Set(['settingsType']))
        mockSdfDeploy.mockRejectedValue(settingsDeployError)
        const change = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        expect(await client.deploy(
          [change],
          SDF_CHANGE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [settingsDeployError],
          appliedChanges: [],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(1)
      })

      describe('custom record types', () => {
        it('should transform type to customrecordtype instance', async () => {
          const change = toChange({
            after: new ObjectType({
              elemID: new ElemID(NETSUITE, 'customrecord1'),
              annotations: {
                [SCRIPT_ID]: 'customrecord1',
                [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
              },
            }),
          })
          expect(await client.deploy(
            [change],
            SDF_CHANGE_GROUP_ID,
            ...deployParams
          )).toEqual({
            errors: [],
            appliedChanges: [change],
          })
          expect(mockSdfDeploy).toHaveBeenCalledWith(
            [{
              scriptId: 'customrecord1',
              typeName: 'customrecordtype',
              values: { '@_scriptid': 'customrecord1' },
            }],
            undefined,
            {
              additionalDependencies: {
                exclude: { features: [], objects: [] }, include: { features: [], objects: [] },
              },
              validateOnly: false,
            },
          )
        })
        it('should transform field to customrecordtype instance', async () => {
          const customRecordType = new ObjectType({
            elemID: new ElemID(NETSUITE, 'customrecord1'),
            fields: {
              custom_field: { refType: BuiltinTypes.STRING },
            },
            annotations: {
              [SCRIPT_ID]: 'customrecord1',
              [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            },
          })
          const change = toChange({
            after: customRecordType.fields.custom_field,
          })
          expect(await client.deploy(
            [change],
            SDF_CHANGE_GROUP_ID,
            ...deployParams
          )).toEqual({
            errors: [],
            appliedChanges: [change],
          })
          expect(mockSdfDeploy).toHaveBeenCalledWith(
            [{
              scriptId: 'customrecord1',
              typeName: 'customrecordtype',
              values: { '@_scriptid': 'customrecord1' },
            }],
            undefined,
            {
              additionalDependencies: {
                exclude: { features: [], objects: [] }, include: { features: [], objects: [] },
              },
              validateOnly: false,
            },
          )
        })
        it('should try again to deploy after ObjectsDeployError field fail', async () => {
          const customRecordType = new ObjectType({
            elemID: new ElemID(NETSUITE, 'customrecord1'),
            fields: {
              custom_field: { refType: BuiltinTypes.STRING },
            },
            annotations: {
              [SCRIPT_ID]: 'customrecord1',
              [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            },
          })
          const objectsDeployError = new ObjectsDeployError('error', new Set(['customrecord1']))
          mockSdfDeploy.mockRejectedValueOnce(objectsDeployError)
          const successChange = toChange({
            after: new InstanceElement(
              'instance',
              new ObjectType({ elemID: new ElemID(NETSUITE, 'type') }),
              { scriptid: 'someObject' }
            ),
          })
          const failedChange = toChange({
            after: customRecordType.fields.custom_field,
          })
          expect(await client.deploy(
            [successChange, failedChange],
            SDF_CHANGE_GROUP_ID,
            ...deployParams
          )).toEqual({
            errors: [objectsDeployError],
            appliedChanges: [successChange],
          })
          expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
        })
      })

      describe('features', () => {
        const type = featuresType()
        const featuresDeployError = new FeaturesDeployError('error', ['ABC'])
        beforeEach(() => {
          mockSdfDeploy.mockRejectedValue(featuresDeployError)
        })
        it('should return error only when the only feature to deployed failed', async () => {
          const before = new InstanceElement(
            ElemID.CONFIG_NAME,
            type,
            {
              feature: {
                ABC: { label: 'label1', id: 'ABC', status: 'DISABLED' },
                DEF: { label: 'label2', id: 'DEF', status: 'DISABLED' },
              },
            }
          )
          const after = new InstanceElement(
            ElemID.CONFIG_NAME,
            type,
            {
              feature: {
                ABC: { label: 'label1', id: 'ABC', status: 'ENABLED' },
                DEF: { label: 'label2', id: 'DEF', status: 'DISABLED' },
              },
            }
          )
          const change = toChange({ before, after })
          expect(await client.deploy(
            [change],
            SDF_CHANGE_GROUP_ID,
            ...deployParams
          )).toEqual({
            errors: [featuresDeployError],
            appliedChanges: [],
          })
        })
        it('should return change and error when some features deployed and some failed', async () => {
          const before = new InstanceElement(
            ElemID.CONFIG_NAME,
            type,
            {
              feature: {
                ABC: { label: 'label1', id: 'ABC', status: 'DISABLED' },
                DEF: { label: 'label2', id: 'DEF', status: 'DISABLED' },
              },
            }
          )
          const after = new InstanceElement(
            ElemID.CONFIG_NAME,
            type,
            {
              feature: {
                ABC: { label: 'label1', id: 'ABC', status: 'ENABLED' },
                DEF: { label: 'label2', id: 'DEF', status: 'ENABLED' },
              },
            }
          )
          const change = toChange({ before, after })
          expect(await client.deploy(
            [change],
            SDF_CHANGE_GROUP_ID,
            ...deployParams
          )).toEqual({
            errors: [featuresDeployError],
            appliedChanges: [change],
          })
        })
      })
    })
    describe('validate', () => {
      let type: ObjectType
      let change: Change<InstanceElement>
      const validateParams: [boolean, AdditionalDependencies] = [deployParams[0], deployParams[1]]
      beforeEach(() => {
        jest.resetAllMocks()
        type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        change = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
      })
      it('should call sdfValidate', async () => {
        await client.validate([change], SDF_CHANGE_GROUP_ID, ...validateParams)
        expect(mockSdfDeploy).toHaveBeenCalledWith(
          [{
            scriptId: 'someObject',
            typeName: 'type',
            values: { scriptid: 'someObject' },
          }],
          undefined,
          { additionalDependencies: validateParams[1], validateOnly: true }
        )
      })
      it('should skip validation', async () => {
        await client.validate([change], SUITEAPP_UPDATING_CONFIG_GROUP_ID, ...validateParams)
        expect(mockSdfDeploy).not.toHaveBeenCalled()
      })
    })
  })
  describe('with SuiteApp client', () => {
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

    const mockElementsSourceIndex = jest.fn() as unknown as LazyElementsSourceIndexes

    const deployParams: [boolean, AdditionalDependencies, LazyElementsSourceIndexes] = [
      false,
      {
        include: { features: [], objects: [] },
        exclude: { features: [], objects: [] },
      },
      mockElementsSourceIndex,
    ]

    const client = new NetsuiteClient(sdfClient, suiteAppClient)

    beforeEach(() => {
      jest.resetAllMocks()
    })

    describe('getPathInternalId', () => {
      it('should return the right id', async () => {
        getPathToIdMapMock.mockReturnValue({ '/some/path': 1 })
        expect(client.getPathInternalId('/some/path')).toBe(1)
        expect(client.getPathInternalId('/some/path2')).toBeUndefined()
      })

      it('should return undefined when failed to get map', async () => {
        getPathToIdMapMock.mockResolvedValue(undefined)
        expect(client.getPathInternalId('/some/path1')).toBeUndefined()
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
          ...deployParams
        )).toEqual({
          errors: [new Error(`Salto SuiteApp is not configured and therefore changes group "${SUITEAPP_UPDATING_RECORDS_GROUP_ID}" cannot be deployed`)],
          elemIdToInternalId: {},
          appliedChanges: [],
        })
        expect(await clientWithoutSuiteApp.deploy(
          [change1, change2],
          SUITEAPP_UPDATING_CONFIG_GROUP_ID,
          ...deployParams
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
          ...deployParams
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
          ...deployParams
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
          ...deployParams
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
          ...deployParams
        )
        expect(results.appliedChanges.length).toEqual(1)
        expect(results.errors.length).toEqual(0)
      })
    })
  })
})
