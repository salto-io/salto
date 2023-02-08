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
import { ElemID, InstanceElement, ObjectType, toChange, Change, BuiltinTypes, ReferenceExpression } from '@salto-io/adapter-api'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import SdfClient from '../../src/client/sdf_client'
import * as suiteAppFileCabinet from '../../src/suiteapp_file_cabinet'
import NetsuiteClient from '../../src/client/client'
import { SDF_CREATE_OR_UPDATE_GROUP_ID, SUITEAPP_CREATING_RECORDS_GROUP_ID, SUITEAPP_DELETING_RECORDS_GROUP_ID, SUITEAPP_SDF_DELETE_GROUP_ID, SUITEAPP_UPDATING_CONFIG_GROUP_ID, SUITEAPP_UPDATING_RECORDS_GROUP_ID } from '../../src/group_changes'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { SetConfigType } from '../../src/client/suiteapp_client/types'
import { SUITEAPP_CONFIG_RECORD_TYPES, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../src/types'
import { featuresType } from '../../src/types/configuration_types'
import { FeaturesDeployError, ManifestValidationError, MissingManifestFeaturesError, ObjectsDeployError, SettingsDeployError } from '../../src/client/errors'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { AdditionalDependencies } from '../../src/client/types'

describe('NetsuiteClient', () => {
  describe('with SDF client', () => {
    const mockSdfDeploy = jest.fn()
    const sdfClient = {
      getCredentials: () => ({ accountId: 'someId' }),
      deploy: mockSdfDeploy,
    } as unknown as SdfClient
    const mockElementsSourceIndex = {
      getIndexes: () => ({ mapKeyFieldsIndex: {} }),
    } as unknown as LazyElementsSourceIndexes
    const client = new NetsuiteClient(sdfClient)

    const deployParams: [
      AdditionalDependencies,
      LazyElementsSourceIndexes,
    ] = [
      {
        include: { features: [], objects: [] },
        exclude: { features: [], objects: [] },
      },
      mockElementsSourceIndex,
    ]
    describe('deploy', () => {
      beforeEach(() => {
        jest.resetAllMocks()
        deployParams[0].include.features = []
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
          SDF_CREATE_OR_UPDATE_GROUP_ID,
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
          SDF_CREATE_OR_UPDATE_GROUP_ID,
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
          SDF_CREATE_OR_UPDATE_GROUP_ID,
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
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [settingsDeployError],
          appliedChanges: [],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(1)
      })

      it('should try to deploy again after ManifestValidationError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on failed_scriptid'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, ['failed_scriptid'])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=test_scriptid]' },),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'scriptid', bad_ref: '[scriptid=failed_scriptid]' }),
        })
        expect(await client.deploy(
          [successChange, failedChange],
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [manifestValidationError],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should try to deploy again after ManifestValidationError from inner NS ref', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on customworkflow1.workflowstate17.workflowaction33'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, ['customworkflow1.workflowstate17.workflowaction33'])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=customworkflow1]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'scriptid', bad_ref: '[scriptid=customworkflow1.workflowstate17.workflowaction33]' }),
        })
        expect(await client.deploy(
          [successChange, failedChange],
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [manifestValidationError],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should not apply any changes if failed scriptid cant be extracted from error message', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on some_id'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, ['some_id'])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=some_ref]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'scriptid', bad_ref: '[scriptid=failed_scriptid]' }),
        })
        expect(await client.deploy(
          [successChange, failedChange],
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [manifestValidationError],
          appliedChanges: [],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(1)
      })

      it('should try to deploy again after ManifestValidationError from salto reference', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'center') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on custcenter1'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, ['custcenter1'])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        const centerInstance = new InstanceElement('name', type, { scriptid: 'custcenter1' })
        const saltoRefExp = new ReferenceExpression(
          centerInstance.elemID.createNestedID(SCRIPT_ID),
          centerInstance.value.scriptid,
          centerInstance
        )
        const failedChange = toChange({
          after: new InstanceElement('failInstance', type, { scriptid: 'otherObject', ref: saltoRefExp }),
        })
        expect(await client.deploy(
          [successChange, failedChange],
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [manifestValidationError],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should try to deploy again after removing instance and its dependencies due to ManifestValidationError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on failed_scriptid'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, ['failed_scriptid'])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=some_ref]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'scriptid', bad_ref: '[scriptid=failed_scriptid]' }),
        })
        const failedChangeDependency = toChange({
          after: new InstanceElement('failedChangedDependency', type, { scriptid: 'dependency_scriptid', ref: '[scriptid=scriptid]' }),
        })
        expect(await client.deploy(
          [successChange, failedChange, failedChangeDependency],
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [manifestValidationError],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should try to deploy again without removing dependencies when the failed changeType is modification', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on failed_scriptid'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, ['failed_scriptid'])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=some_ref]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'scriptid', bad_ref: '[scriptid=failed_scriptid]', changeField: 'after' }),
          before: new InstanceElement('failedInstance', type, { scriptid: 'scriptid', bad_ref: '[scriptid=failed_scriptid]', changeField: 'before' }),
        })
        const failedChangeDependency = toChange({
          after: new InstanceElement('failedChangedDependency', type, { scriptid: 'dependency_scriptid', ref: '[scriptid=scriptid]' }),
        })
        expect(await client.deploy(
          [successChange, failedChange, failedChangeDependency],
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [manifestValidationError],
          appliedChanges: [successChange, failedChangeDependency],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should try to deploy again MissingManifestFeaturesError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const missingManifestFeatureMessage = `An error occurred during custom object validation. (custimport_xepi_subscriptionimport)
Details: You must specify the SUBSCRIPTIONBILLING(Subscription Billing) feature in the project manifest as required to use the SUBSCRIPTION value in the recordtype field.
File: ~/Objects/custimport_xepi_subscriptionimport.xml`
        const missingManifestFeaturesError = new MissingManifestFeaturesError(missingManifestFeatureMessage, ['SUBSCRIPTIONBILLING'])
        mockSdfDeploy.mockRejectedValueOnce(missingManifestFeaturesError)
        const change = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        expect(await client.deploy(
          [change],
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [],
          appliedChanges: [change],
        })
        expect(deployParams[0].include.features).toContain('SUBSCRIPTIONBILLING')
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
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
            SDF_CREATE_OR_UPDATE_GROUP_ID,
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
        it('should include custom record type field in appliedChanges', async () => {
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
          const objectsDeployError = new ObjectsDeployError('error', new Set(['some_object']))
          mockSdfDeploy.mockRejectedValueOnce(objectsDeployError)
          const failedChange = toChange({
            after: new InstanceElement(
              'instance',
              new ObjectType({ elemID: new ElemID(NETSUITE, 'type') }),
              { scriptid: 'some_object' }
            ),
          })
          const successTypeChange = toChange({
            after: customRecordType,
          })
          const successFieldChange = toChange({
            after: customRecordType.fields.custom_field,
          })
          expect(await client.deploy(
            [successTypeChange, successFieldChange, failedChange],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams
          )).toEqual({
            errors: [objectsDeployError],
            appliedChanges: [successTypeChange, successFieldChange],
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
            SDF_CREATE_OR_UPDATE_GROUP_ID,
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
            SDF_CREATE_OR_UPDATE_GROUP_ID,
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
      beforeEach(() => {
        jest.resetAllMocks()
        type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        change = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
      })
      it('should call sdfValidate', async () => {
        await client.validate([change], SDF_CREATE_OR_UPDATE_GROUP_ID, ...deployParams)
        expect(mockSdfDeploy).toHaveBeenCalledWith(
          [{
            scriptId: 'someObject',
            typeName: 'type',
            values: { scriptid: 'someObject' },
          }],
          undefined,
          { additionalDependencies: deployParams[0], validateOnly: true }
        )
      })
      it('should skip validation', async () => {
        await client.validate([change], SUITEAPP_SDF_DELETE_GROUP_ID, ...deployParams)
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
    const deleteSdfInstancesMock = jest.fn()
    const getConfigRecordsMock = jest.fn()
    const setConfigRecordsValuesMock = jest.fn()

    const suiteAppClient = {
      updateInstances: updateInstancesMock,
      addInstances: addInstancesMock,
      deleteInstances: deleteInstancesMock,
      deleteSdfInstances: deleteSdfInstancesMock,
      getConfigRecords: getConfigRecordsMock,
      setConfigRecordsValues: setConfigRecordsValuesMock,
    } as unknown as SuiteAppClient

    const getPathToIdMapMock = jest.fn()
    jest.spyOn(suiteAppFileCabinet, 'createSuiteAppFileCabinetOperations').mockReturnValue({
      getPathToIdMap: getPathToIdMapMock,
    } as unknown as suiteAppFileCabinet.SuiteAppFileCabinetOperations)

    const mockElementsSourceIndex = jest.fn() as unknown as LazyElementsSourceIndexes

    const deployParams: [
      AdditionalDependencies,
      LazyElementsSourceIndexes,
    ] = [
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
        expect(await clientWithoutSuiteApp.deploy(
          [change1, change2],
          SUITEAPP_SDF_DELETE_GROUP_ID,
          ...deployParams
        )).toEqual({
          errors: [new Error(`Salto SuiteApp is not configured and therefore changes group "${SUITEAPP_SDF_DELETE_GROUP_ID}" cannot be deployed`)],
          elemIdToInternalId: {},
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

      it('should use deleteInstances for sdf instances deletions', async () => {
        deleteSdfInstancesMock.mockResolvedValue([1, new Error('error')])
        const results = await client.deploy(
          [
            toChange({ before: instance1 }),
            toChange({ before: instance2 }),
          ],
          SUITEAPP_SDF_DELETE_GROUP_ID,
          ...deployParams
        )
        expect(results.appliedChanges).toEqual([toChange({ before: instance1 })])
        expect(results.errors).toEqual([new Error('error')])
      })
    })
  })
})
