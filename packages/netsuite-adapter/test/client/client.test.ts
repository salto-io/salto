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
import {
  ElemID,
  InstanceElement,
  ObjectType,
  toChange,
  Change,
  BuiltinTypes,
  getChangeData,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import SuiteAppClient from '../../src/client/suiteapp_client/suiteapp_client'
import SdfClient from '../../src/client/sdf_client'
import {
  SDF_CREATE_OR_UPDATE_GROUP_ID,
  SUITEAPP_CREATING_RECORDS_GROUP_ID,
  SUITEAPP_DELETING_RECORDS_GROUP_ID,
  SDF_DELETE_GROUP_ID,
  SUITEAPP_UPDATING_CONFIG_GROUP_ID,
  SUITEAPP_UPDATING_RECORDS_GROUP_ID,
} from '../../src/group_changes'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import { SetConfigType } from '../../src/client/suiteapp_client/types'
import { SUITEAPP_CONFIG_RECORD_TYPES, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES } from '../../src/types'
import { featuresType } from '../../src/types/configuration_types'
import {
  FeaturesDeployError,
  ManifestValidationError,
  MissingManifestFeaturesError,
  ObjectsDeployError,
  SettingsDeployError,
} from '../../src/client/errors'
import { AdditionalDependencies } from '../../src/config/types'
import { Graph, GraphNode } from '../../src/client/graph_utils'
import { SDFObjectNode } from '../../src/client/types'
import { roleType } from '../../src/autogen/types/standard_types/role'
import NetsuiteClient from '../../src/client/client'

describe('NetsuiteClient', () => {
  describe('with SDF client', () => {
    const mockSdfDeploy = jest.fn()
    const sdfClient = {
      getCredentials: () => ({ accountId: 'someId' }),
      deploy: mockSdfDeploy,
    } as unknown as SdfClient

    const client = new NetsuiteClient(sdfClient)

    const deployParams: [AdditionalDependencies] = [
      {
        include: { features: [], objects: [], files: [] },
        exclude: { features: [], objects: [], files: [] },
      },
    ]

    let testGraph: Graph<SDFObjectNode>
    beforeEach(() => {
      testGraph = new Graph()
    })
    describe('deploy', () => {
      beforeEach(() => {
        jest.resetAllMocks()
        deployParams[0].include.features = []
      })
      describe('Dependency graph and map', () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const instanceWithRef1 = new InstanceElement('instanceWithRef1', type, { scriptid: 'instanceWithRef1' })
        const instanceWithRef2 = new InstanceElement('instanceWithRef2', type, {
          scriptid: 'instanceWithRef2',
          ref: new ReferenceExpression(instanceWithRef1.elemID),
        })
        instanceWithRef1.value.ref = new ReferenceExpression(instanceWithRef2.elemID)

        const customRecord = new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord_1'),
          annotations: {
            scriptid: 'customrecord_1',
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            permissions: {
              permission: {
                ref: '[scriptid=customrole_with_ref]',
              },
            },
          },
        })
        const roleWithRef = new InstanceElement('customrole_with_ref', roleType().type, {
          scriptid: 'customrole_with_ref',
          ref: '[scriptid=customrecord_1]',
        })
        it('should build a map and a graph with an edge role->customrecord when given new role and existing custom record ', async () => {
          const mapAndGraph = await NetsuiteClient.createDependencyMapAndGraph([
            toChange({ after: roleWithRef }),
            toChange({ before: customRecord, after: customRecord }),
          ])
          const { dependencyMap, dependencyGraph } = mapAndGraph
          expect(dependencyMap.get(roleWithRef.elemID.getFullName())?.has('customrecord_1')).toBeTruthy()
          expect(dependencyGraph.nodes.get(roleWithRef.elemID.getFullName())?.edges.size).toEqual(1)
          expect(
            dependencyGraph.nodes.get(roleWithRef.elemID.getFullName())?.edges.get(customRecord.elemID.getFullName()),
          ).not.toBeUndefined()
        })
        it('should build a map and a graph with an edge role->customrecord when given new role and new custom record ', async () => {
          const mapAndGraph = await NetsuiteClient.createDependencyMapAndGraph([
            toChange({ after: roleWithRef }),
            toChange({ after: customRecord }),
          ])
          const { dependencyMap, dependencyGraph } = mapAndGraph
          expect(dependencyMap.get(roleWithRef.elemID.getFullName())?.has('customrecord_1')).toBeTruthy()
          expect(dependencyGraph.nodes.get(roleWithRef.elemID.getFullName())?.edges.size).toEqual(1)
          expect(
            dependencyGraph.nodes.get(roleWithRef.elemID.getFullName())?.edges.get(customRecord.elemID.getFullName()),
          ).not.toBeUndefined()
        })
        it('should build a map and a graph with an edge role->customrecord when given existing role and new custom record ', async () => {
          const mapAndGraph = await NetsuiteClient.createDependencyMapAndGraph([
            toChange({ before: roleWithRef, after: roleWithRef }),
            toChange({ after: customRecord }),
          ])
          const { dependencyMap, dependencyGraph } = mapAndGraph
          expect(dependencyMap.get(roleWithRef.elemID.getFullName())?.has('customrecord_1')).toBeTruthy()
          expect(dependencyGraph.nodes.get(roleWithRef.elemID.getFullName())?.edges.size).toEqual(1)
          expect(
            dependencyGraph.nodes.get(roleWithRef.elemID.getFullName())?.edges.get(customRecord.elemID.getFullName()),
          ).not.toBeUndefined()
        })
      })
      it('should try again to deploy after ObjectsDeployError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const failedObjectsMap = new Map([['failedObject', [{ message: 'error' }]]])
        const objectsDeployError = new ObjectsDeployError('error', failedObjectsMap)
        mockSdfDeploy.mockRejectedValueOnce(objectsDeployError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'failedObject' }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              elemID: getChangeData(failedChange).elemID,
              message: objectsDeployError.message,
              severity: 'Error',
            },
          ],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })
      it("should fail when failed changes couldn't be found in ObjectsDeployError", async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const failedObjectsMap = new Map([['unknownObject', [{ message: 'error' }]]])
        const objectsDeployError = new ObjectsDeployError('error', failedObjectsMap)
        mockSdfDeploy.mockRejectedValueOnce(objectsDeployError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, { scriptid: 'failedObject' }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [{ message: objectsDeployError.message, severity: 'Error' }],
          appliedChanges: [],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(1)
      })
      it('should try again to deploy after SettingsDeployError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const settingsType = new ObjectType({ elemID: new ElemID(NETSUITE, 'settingsType') })
        const failedSettingsMap = new Map([['settingsType', [{ message: 'error' }]]])
        const settingsDeployError = new SettingsDeployError('error', failedSettingsMap)
        mockSdfDeploy.mockRejectedValueOnce(settingsDeployError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        const failedChange = toChange({
          after: new InstanceElement(ElemID.CONFIG_NAME, settingsType),
        })
        expect(
          await client.deploy(
            [successChange, failedChange],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              elemID: getChangeData(failedChange).elemID,
              message: settingsDeployError.message,
              severity: 'Error',
            },
          ],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })
      it("should not try again to deploy if SettingsDeployError doesn't contain an actual failing change", async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const failedSettingsMap = new Map([['settingsType', [{ message: 'error' }]]])
        const settingsDeployError = new SettingsDeployError('error', failedSettingsMap)
        mockSdfDeploy.mockRejectedValue(settingsDeployError)
        const change = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        expect(await client.deploy([change], SDF_CREATE_OR_UPDATE_GROUP_ID, ...deployParams, async () => true)).toEqual(
          {
            errors: [{ message: settingsDeployError.message, severity: 'Error' }],
            appliedChanges: [],
          },
        )
        expect(mockSdfDeploy).toHaveBeenCalledTimes(1)
      })

      it('should try to deploy again after ManifestValidationError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on failed_scriptid'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, [
          { message: manifestErrorMessage, scriptId: 'failed_scriptid' },
        ])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=test_scriptid]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, {
            scriptid: 'scriptid',
            bad_ref: '[scriptid=failed_scriptid]',
          }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              elemID: getChangeData(failedChange).elemID,
              message: manifestValidationError.message,
              severity: 'Error',
            },
          ],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should try to deploy again after ManifestValidationError from inner NS ref', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage =
          'Details: The manifest contains a dependency on customworkflow1.workflowstate17.workflowaction33'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, [
          { message: manifestErrorMessage, scriptId: 'customworkflow1.workflowstate17.workflowaction33' },
        ])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=customworkflow1]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, {
            scriptid: 'scriptid',
            bad_ref: '[scriptid=customworkflow1.workflowstate17.workflowaction33]',
          }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              elemID: getChangeData(failedChange).elemID,
              message: manifestValidationError.message,
              severity: 'Error',
            },
          ],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should not apply any changes if failed scriptid cant be extracted from error message', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on some_id'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, [
          { message: manifestErrorMessage, scriptId: 'some_id' },
        ])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=some_ref]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, {
            scriptid: 'scriptid',
            bad_ref: '[scriptid=failed_scriptid]',
          }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [{ message: manifestValidationError.message, severity: 'Error' }],
          appliedChanges: [],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(1)
      })

      it('should try to deploy again after removing instance and its dependencies due to ManifestValidationError', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on failed_scriptid'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, [
          { message: manifestErrorMessage, scriptId: 'failed_scriptid' },
        ])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=some_ref]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, {
            scriptid: 'scriptid',
            bad_ref: '[scriptid=failed_scriptid]',
          }),
        })
        const failedChangeDependency = toChange({
          after: new InstanceElement('failedChangedDependency', type, {
            scriptid: 'dependency_scriptid',
            ref: '[scriptid=scriptid]',
          }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange, failedChangeDependency],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              elemID: getChangeData(failedChange).elemID,
              message: manifestValidationError.message,
              severity: 'Error',
            },
            {
              elemID: getChangeData(failedChangeDependency).elemID,
              message: `Element cannot be deployed due to an error in its dependency: ${getChangeData(failedChange).elemID.getFullName()}`,
              severity: 'Error',
            },
          ],
          appliedChanges: [successChange],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should try to deploy again without removing dependencies when the failed changeType is modification', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on failed_scriptid'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, [
          { message: manifestErrorMessage, scriptId: 'failed_scriptid' },
        ])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=some_ref]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, {
            scriptid: 'scriptid',
            bad_ref: '[scriptid=failed_scriptid]',
            changeField: 'after',
          }),
          before: new InstanceElement('failedInstance', type, {
            scriptid: 'scriptid',
            bad_ref: '[scriptid=failed_scriptid]',
            changeField: 'before',
          }),
        })
        const failedChangeDependency = toChange({
          after: new InstanceElement('failedChangedDependency', type, {
            scriptid: 'dependency_scriptid',
            ref: '[scriptid=scriptid]',
          }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange, failedChangeDependency],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              elemID: getChangeData(failedChange).elemID,
              message: manifestValidationError.message,
              severity: 'Error',
            },
          ],
          appliedChanges: [successChange, failedChangeDependency],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should try to deploy again after removing dependencies when the failed changeType is modification but the dependency is on added object', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on failed_scriptid'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, [
          { message: manifestErrorMessage, scriptId: 'failed_scriptid' },
        ])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=some_ref]' }),
        })
        const failedChange = toChange({
          after: new InstanceElement('failedInstance', type, {
            scriptid: 'scriptid',
            bad_ref: '[scriptid=failed_scriptid]',
            changeField: 'after',
            inner: { scriptid: 'inner' },
          }),
          before: new InstanceElement('failedInstance', type, {
            scriptid: 'scriptid',
            bad_ref: '[scriptid=failed_scriptid]',
            changeField: 'before',
          }),
        })
        const failedChangeDependency = toChange({
          after: new InstanceElement('failedChangedDependency', type, {
            scriptid: 'no_dependency_scriptid',
            ref: '[scriptid=scriptid]',
          }),
        })
        const failedChangeInnerDependency = toChange({
          after: new InstanceElement('failedChangedInnerDependency', type, {
            scriptid: 'dependency_scriptid',
            ref: '[scriptid=scriptid.inner]',
          }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange, failedChangeDependency, failedChangeInnerDependency],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              elemID: getChangeData(failedChange).elemID,
              message: manifestValidationError.message,
              severity: 'Error',
            },
            {
              elemID: getChangeData(failedChangeInnerDependency).elemID,
              message: `Element cannot be deployed due to an error in its dependency: ${getChangeData(failedChange).elemID.getFullName()}`,
              severity: 'Error',
            },
          ],
          appliedChanges: [successChange, failedChangeDependency],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should try to deploy again after removing dependencies when the failed changeType is modification but the dependency is on added field', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const manifestErrorMessage = 'Details: The manifest contains a dependency on failed_scriptid'
        const manifestValidationError = new ManifestValidationError(manifestErrorMessage, [
          { message: manifestErrorMessage, scriptId: 'failed_scriptid' },
        ])
        mockSdfDeploy.mockRejectedValueOnce(manifestValidationError)
        const successChange = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject', ref: '[scriptid=some_ref]' }),
        })
        const failedChange = toChange({
          after: new ObjectType({
            elemID: new ElemID(NETSUITE, 'customrecord1'),
            fields: {
              scriptid: { refType: BuiltinTypes.SERVICE_ID },
              custom_field: {
                refType: BuiltinTypes.STRING,
                annotations: { scriptid: 'custfield123' },
              },
              added_custom_field: {
                refType: BuiltinTypes.STRING,
                annotations: { scriptid: 'custfield123added' },
              },
            },
            annotations: {
              scriptid: 'customrecord1',
              bad_ref: '[scriptid=failed_scriptid]',
              [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            },
          }),
          before: new ObjectType({
            elemID: new ElemID(NETSUITE, 'customrecord1'),
            fields: {
              scriptid: { refType: BuiltinTypes.SERVICE_ID },
              custom_field: {
                refType: BuiltinTypes.STRING,
                annotations: { scriptid: 'custfield123' },
              },
            },
            annotations: {
              scriptid: 'customrecord1',
              bad_ref: '[scriptid=failed_scriptid]',
              [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            },
          }),
        })
        const failedChangeFieldDependency = toChange({
          after: new InstanceElement('failedChangeFieldDependency', type, {
            scriptid: 'no_dependency_scriptid',
            ref: '[scriptid=customrecord1.custfield123]',
          }),
        })
        const failedChangeAddedFieldDependency = toChange({
          after: new InstanceElement('failedChangeAddedFieldDependency', type, {
            scriptid: 'dependency_scriptid',
            ref: '[scriptid=customrecord1.custfield123added]',
          }),
        })
        expect(
          await client.deploy(
            [successChange, failedChange, failedChangeFieldDependency, failedChangeAddedFieldDependency],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              elemID: getChangeData(failedChange).elemID,
              message: manifestValidationError.message,
              severity: 'Error',
            },
            {
              elemID: getChangeData(failedChangeAddedFieldDependency).elemID,
              message: `Element cannot be deployed due to an error in its dependency: ${getChangeData(failedChange).elemID.getFullName()}`,
              severity: 'Error',
            },
          ],
          appliedChanges: [successChange, failedChangeFieldDependency],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
      })

      it('should pass features to sdf_client deploy', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const change = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        testGraph.addNodes([
          new GraphNode('netsuite.type.instance.instance', {
            serviceid: 'someObject',
            changeType: 'addition',
            customizationInfo: { scriptId: 'someObject', typeName: 'type', values: { scriptid: 'someObject' } },
            change,
          }),
        ])
        await client.deploy(
          [change],
          SDF_CREATE_OR_UPDATE_GROUP_ID,
          {
            include: {
              features: ['optional', 'required:required'],
              objects: [],
              files: [],
            },
            exclude: {
              features: ['excluded'],
              objects: [],
              files: [],
            },
          },
          async () => true,
        )
        expect(mockSdfDeploy).toHaveBeenCalledWith(
          undefined,
          {
            manifestDependencies: {
              optionalFeatures: ['optional'],
              requiredFeatures: ['required'],
              excludedFeatures: ['excluded'],
              includedObjects: [],
              excludedObjects: [],
              includedFiles: [],
              excludedFiles: [],
            },
            validateOnly: false,
          },
          testGraph,
        )
      })

      it('should try to deploy again MissingManifestFeaturesError and fail on excluded feature', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const missingManifestFeatureMessage = `An error occurred during custom object validation. (custimport_xepi_subscriptionimport)
Details: You must specify the SUBSCRIPTIONBILLING(Subscription Billing) feature in the project manifest as required to use the SUBSCRIPTION value in the recordtype field.
File: ~/Objects/custimport_xepi_subscriptionimport.xml`
        const missingManifestFeaturesError = new MissingManifestFeaturesError(missingManifestFeatureMessage, [
          'SUBSCRIPTIONBILLING',
        ])
        mockSdfDeploy.mockRejectedValue(missingManifestFeaturesError)
        const change = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        testGraph.addNodes([
          new GraphNode('netsuite.type.instance.instance', {
            serviceid: 'someObject',
            changeType: 'addition',
            customizationInfo: { scriptId: 'someObject', typeName: 'type', values: { scriptid: 'someObject' } },
            change,
          }),
        ])
        expect(
          await client.deploy(
            [change],
            SDF_CREATE_OR_UPDATE_GROUP_ID,
            {
              include: {
                features: [],
                objects: [],
                files: [],
              },
              exclude: {
                features: ['SUBSCRIPTIONBILLING'],
                objects: [],
                files: [],
              },
            },
            async () => true,
          ),
        ).toEqual({
          errors: [
            { message: missingManifestFeaturesError.message, severity: 'Error' },
            {
              message: 'The following features are required but they are excluded: SUBSCRIPTIONBILLING.',
              severity: 'Error',
            },
          ],
          appliedChanges: [],
        })
        expect(mockSdfDeploy).toHaveBeenCalledTimes(2)
        expect(mockSdfDeploy).toHaveBeenNthCalledWith(
          1,
          undefined,
          {
            manifestDependencies: {
              optionalFeatures: [],
              requiredFeatures: [],
              excludedFeatures: ['SUBSCRIPTIONBILLING'],
              includedObjects: [],
              excludedObjects: [],
              includedFiles: [],
              excludedFiles: [],
            },
            validateOnly: false,
          },
          testGraph,
        )
        expect(mockSdfDeploy).toHaveBeenNthCalledWith(
          2,
          undefined,
          {
            manifestDependencies: {
              optionalFeatures: ['SUBSCRIPTIONBILLING'],
              requiredFeatures: [],
              excludedFeatures: [],
              includedObjects: [],
              excludedObjects: [],
              includedFiles: [],
              excludedFiles: [],
            },
            validateOnly: false,
          },
          testGraph,
        )
      })

      it('should try to deploy again MissingManifestFeaturesError and fail on required feature', async () => {
        const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'type') })
        const missingManifestFeatureMessage = `An error occurred during custom object validation. (custimport_xepi_subscriptionimport)
Details: You must specify the SUBSCRIPTIONBILLING(Subscription Billing) feature in the project manifest as required to use the SUBSCRIPTION value in the recordtype field.
File: ~/Objects/custimport_xepi_subscriptionimport.xml`
        const missingManifestFeaturesError = new MissingManifestFeaturesError(missingManifestFeatureMessage, [
          'SUBSCRIPTIONBILLING',
        ])
        mockSdfDeploy.mockRejectedValue(missingManifestFeaturesError)
        const change = toChange({
          after: new InstanceElement('instance', type, { scriptid: 'someObject' }),
        })
        testGraph.addNodes([
          new GraphNode('netsuite.type.instance.instance', {
            serviceid: 'someObject',
            changeType: 'addition',
            customizationInfo: { scriptId: 'someObject', typeName: 'type', values: { scriptid: 'someObject' } },
            change,
          }),
        ])
        expect(await client.deploy([change], SDF_CREATE_OR_UPDATE_GROUP_ID, ...deployParams, async () => true)).toEqual(
          {
            errors: [{ message: missingManifestFeaturesError.message, severity: 'Error' }],
            appliedChanges: [],
          },
        )
        expect(mockSdfDeploy).toHaveBeenCalledTimes(3)
        expect(mockSdfDeploy).toHaveBeenNthCalledWith(
          1,
          undefined,
          {
            manifestDependencies: {
              optionalFeatures: [],
              requiredFeatures: [],
              excludedFeatures: [],
              includedObjects: [],
              excludedObjects: [],
              includedFiles: [],
              excludedFiles: [],
            },
            validateOnly: false,
          },
          testGraph,
        )
        expect(mockSdfDeploy).toHaveBeenNthCalledWith(
          2,
          undefined,
          {
            manifestDependencies: {
              optionalFeatures: ['SUBSCRIPTIONBILLING'],
              requiredFeatures: [],
              excludedFeatures: [],
              includedObjects: [],
              excludedObjects: [],
              includedFiles: [],
              excludedFiles: [],
            },
            validateOnly: false,
          },
          testGraph,
        )
        expect(mockSdfDeploy).toHaveBeenNthCalledWith(
          3,
          undefined,
          {
            manifestDependencies: {
              optionalFeatures: [],
              requiredFeatures: ['SUBSCRIPTIONBILLING'],
              excludedFeatures: [],
              includedObjects: [],
              excludedObjects: [],
              includedFiles: [],
              excludedFiles: [],
            },
            validateOnly: false,
          },
          testGraph,
        )
      })

      describe('custom record types', () => {
        const customizationInfo = {
          scriptId: 'customrecord1',
          typeName: 'customrecordtype',
          values: { '@_scriptid': 'customrecord1' },
        }
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
          testGraph.addNodes([
            new GraphNode('netsuite.customrecord1', {
              serviceid: 'customrecord1',
              changeType: 'addition',
              customizationInfo,
              change,
            }),
          ])
          expect(
            await client.deploy([change], SDF_CREATE_OR_UPDATE_GROUP_ID, ...deployParams, async () => true),
          ).toEqual({
            errors: [],
            appliedChanges: [change],
          })
          expect(mockSdfDeploy).toHaveBeenCalledWith(
            undefined,
            {
              manifestDependencies: {
                optionalFeatures: [],
                requiredFeatures: [],
                excludedFeatures: [],
                includedObjects: [],
                excludedObjects: [],
                includedFiles: [],
                excludedFiles: [],
              },
              validateOnly: false,
            },
            testGraph,
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
          const failedObjectsMap = new Map([['some_object', [{ message: 'error' }]]])
          const objectsDeployError = new ObjectsDeployError('error', failedObjectsMap)
          mockSdfDeploy.mockRejectedValueOnce(objectsDeployError)
          const failedChange = toChange({
            after: new InstanceElement('instance', new ObjectType({ elemID: new ElemID(NETSUITE, 'type') }), {
              scriptid: 'some_object',
            }),
          })
          const successTypeChange = toChange({
            after: customRecordType,
          })
          const successFieldChange = toChange({
            after: customRecordType.fields.custom_field,
          })
          expect(
            await client.deploy(
              [successTypeChange, successFieldChange, failedChange],
              SDF_CREATE_OR_UPDATE_GROUP_ID,
              ...deployParams,
              async () => true,
            ),
          ).toEqual({
            errors: [
              {
                elemID: getChangeData(failedChange).elemID,
                message: objectsDeployError.message,
                severity: 'Error',
              },
            ],
            appliedChanges: [successTypeChange, successFieldChange],
          })
        })
      })

      describe('features', () => {
        const type = featuresType()
        const featuresDeployError = new FeaturesDeployError('error', ['ABC'])
        beforeEach(() => {
          mockSdfDeploy.mockRejectedValue(featuresDeployError)
        })
        it('should return error only when the only feature to deployed failed', async () => {
          const before = new InstanceElement(ElemID.CONFIG_NAME, type, {
            feature: {
              ABC: { label: 'label1', id: 'ABC', status: 'DISABLED' },
              DEF: { label: 'label2', id: 'DEF', status: 'DISABLED' },
            },
          })
          const after = new InstanceElement(ElemID.CONFIG_NAME, type, {
            feature: {
              ABC: { label: 'label1', id: 'ABC', status: 'ENABLED' },
              DEF: { label: 'label2', id: 'DEF', status: 'DISABLED' },
            },
          })
          const change = toChange({ before, after })
          expect(
            await client.deploy([change], SDF_CREATE_OR_UPDATE_GROUP_ID, ...deployParams, async () => true),
          ).toEqual({
            errors: [
              {
                elemID: after.elemID,
                message: featuresDeployError.message,
                severity: 'Error',
              },
            ],
            appliedChanges: [],
            failedFeaturesIds: ['ABC'],
          })
        })
        it('should return change and error when some features deployed and some failed', async () => {
          const before = new InstanceElement(ElemID.CONFIG_NAME, type, {
            feature: {
              ABC: { label: 'label1', id: 'ABC', status: 'DISABLED' },
              DEF: { label: 'label2', id: 'DEF', status: 'DISABLED' },
            },
          })
          const after = new InstanceElement(ElemID.CONFIG_NAME, type, {
            feature: {
              ABC: { label: 'label1', id: 'ABC', status: 'ENABLED' },
              DEF: { label: 'label2', id: 'DEF', status: 'ENABLED' },
            },
          })
          const change = toChange({ before, after })
          expect(
            await client.deploy([change], SDF_CREATE_OR_UPDATE_GROUP_ID, ...deployParams, async () => true),
          ).toEqual({
            errors: [
              {
                elemID: after.elemID,
                message: featuresDeployError.message,
                severity: 'Error',
              },
            ],
            appliedChanges: [change],
            failedFeaturesIds: ['ABC'],
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
        const customizationInfo = {
          scriptId: 'someObject',
          typeName: 'type',
          values: { scriptid: 'someObject' },
        }
        testGraph.addNodes([
          new GraphNode('netsuite.type.instance.instance', {
            serviceid: 'someObject',
            changeType: 'addition',
            customizationInfo,
            change,
          }),
        ])
        await client.validate([change], SDF_CREATE_OR_UPDATE_GROUP_ID, deployParams[0])
        expect(mockSdfDeploy).toHaveBeenCalledWith(
          undefined,
          {
            manifestDependencies: {
              optionalFeatures: [],
              requiredFeatures: [],
              excludedFeatures: [],
              includedObjects: [],
              excludedObjects: [],
              includedFiles: [],
              excludedFiles: [],
            },
            validateOnly: true,
          },
          testGraph,
        )
      })
      it('should skip validation', async () => {
        await client.validate([change], SDF_DELETE_GROUP_ID, deployParams[0])
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

    const deployParams: [AdditionalDependencies] = [
      {
        include: { features: [], objects: [], files: [] },
        exclude: { features: [], objects: [], files: [] },
      },
    ]

    const client = new NetsuiteClient(sdfClient, suiteAppClient)

    beforeEach(() => {
      jest.resetAllMocks()
    })

    describe('deploy', () => {
      const type = new ObjectType({
        elemID: new ElemID(NETSUITE, 'subsidiary'),
      })
      const instance1 = new InstanceElement('instance1', type)

      const instance2 = new InstanceElement('instance2', type)
      const change1 = toChange({ before: instance1, after: instance1 })
      const change2 = toChange({ before: instance2, after: instance2 })
      it('should return error if suiteApp is not installed', async () => {
        const clientWithoutSuiteApp = new NetsuiteClient(sdfClient)
        expect(
          await clientWithoutSuiteApp.deploy(
            [change1, change2],
            SUITEAPP_UPDATING_RECORDS_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              message: `Salto SuiteApp is not configured and therefore changes group "${SUITEAPP_UPDATING_RECORDS_GROUP_ID}" cannot be deployed`,
              severity: 'Error',
            },
          ],
          appliedChanges: [],
        })
        expect(
          await clientWithoutSuiteApp.deploy(
            [change1, change2],
            SUITEAPP_UPDATING_CONFIG_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              message: `Salto SuiteApp is not configured and therefore changes group "${SUITEAPP_UPDATING_CONFIG_GROUP_ID}" cannot be deployed`,
              severity: 'Error',
            },
          ],
          appliedChanges: [],
        })
        expect(
          await clientWithoutSuiteApp.deploy(
            [change1, change2],
            SDF_DELETE_GROUP_ID,
            ...deployParams,
            async () => true,
          ),
        ).toEqual({
          errors: [
            {
              message: `Salto SuiteApp is not configured and therefore changes group "${SDF_DELETE_GROUP_ID}" cannot be deployed`,
              severity: 'Error',
            },
          ],
          appliedChanges: [],
        })
      })
      it('should use updateInstances for data instances modifications', async () => {
        updateInstancesMock.mockResolvedValue([1, new Error('error')])
        const results = await client.deploy(
          [change1, change2],
          SUITEAPP_UPDATING_RECORDS_GROUP_ID,
          ...deployParams,
          async () => true,
        )
        expect(results.appliedChanges).toEqual([change1])
        expect(results.errors).toEqual([{ elemID: getChangeData(change2).elemID, message: 'error', severity: 'Error' }])
        expect(results.elemIdToInternalId).toEqual({ [instance1.elemID.getFullName()]: '1' })
      })

      it('should use addInstances for data instances creations', async () => {
        addInstancesMock.mockResolvedValue([1, new Error('error')])
        const results = await client.deploy(
          [toChange({ after: instance1 }), toChange({ after: instance2 })],
          SUITEAPP_CREATING_RECORDS_GROUP_ID,
          ...deployParams,
          async () => true,
        )
        expect(results.appliedChanges).toEqual([toChange({ after: instance1 })])
        expect(results.errors).toEqual([{ elemID: instance2.elemID, message: 'error', severity: 'Error' }])
        expect(results.elemIdToInternalId).toEqual({ [instance1.elemID.getFullName()]: '1' })
      })

      it('should use deleteInstances for data instances deletions', async () => {
        deleteInstancesMock.mockResolvedValue([1, new Error('error')])
        const results = await client.deploy(
          [toChange({ before: instance1 }), toChange({ before: instance2 })],
          SUITEAPP_DELETING_RECORDS_GROUP_ID,
          ...deployParams,
          async () => true,
        )
        expect(results.appliedChanges).toEqual([toChange({ before: instance1 })])
        expect(results.errors).toEqual([{ elemID: instance2.elemID, message: 'error', severity: 'Error' }])
      })

      it('should use deployConfigChanges for config instances', async () => {
        setConfigRecordsValuesMock.mockImplementation(types =>
          types.map(({ configType }: SetConfigType) => ({ configType, status: 'success' })),
        )

        const configType = SUITEAPP_CONFIG_RECORD_TYPES[0]
        const configObjectType = new ObjectType({
          elemID: new ElemID(NETSUITE, SUITEAPP_CONFIG_TYPES_TO_TYPE_NAMES[configType]),
        })

        const results = await client.deploy(
          [
            toChange({
              before: new InstanceElement(ElemID.CONFIG_NAME, configObjectType, { configType, field: true }),
              after: new InstanceElement(ElemID.CONFIG_NAME, configObjectType, { configType, field: false }),
            }),
          ],
          SUITEAPP_UPDATING_CONFIG_GROUP_ID,
          ...deployParams,
          async () => true,
        )
        expect(results.appliedChanges.length).toEqual(1)
        expect(results.errors.length).toEqual(0)
      })

      it('should use deleteInstances for sdf instances deletions', async () => {
        deleteSdfInstancesMock.mockResolvedValue([1, new Error('error')])
        const results = await client.deploy(
          [toChange({ before: instance1 }), toChange({ before: instance2 })],
          SDF_DELETE_GROUP_ID,
          ...deployParams,
          async () => true,
        )
        expect(results.appliedChanges).toEqual([toChange({ before: instance1 })])
        expect(results.errors).toEqual([{ elemID: instance2.elemID, message: 'error', severity: 'Error' }])
      })
    })
  })
})
