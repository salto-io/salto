/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { FileProperties } from '@salto-io/jsforce'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import { defaultFilterContext } from '../utils'
import mockClient from '../client'
import filterCreator, { createActiveVersionFileProperties } from '../../src/filters/flows_filter'
import * as filterModule from '../../src/filters/flows_filter'
import {
  ACTIVE_VERSION_NUMBER,
  APEX_CLASS_METADATA_TYPE,
  FLOW_DEFINITION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  INTERNAL_ID_FIELD,
  METADATA_TYPE,
  SALESFORCE,
  STATUS,
} from '../../src/constants'
import { mockFileProperties } from '../connection'
import { createInstanceElement } from '../../src/transformers/transformer'
import { createFlowChange, mockTypes } from '../mock_elements'
import * as fetchModule from '../../src/fetch'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { FilterWith } from './mocks'
import { SalesforceClient } from '../../index'
import { apiNameSync, getMetadataIncludeFromFetchTargets, isInstanceOfTypeSync } from '../../src/filters/utils'
import Connection from '../../src/client/jsforce'
import { SalesforceRecord } from '../../src/client/types'
import { buildMetadataQuery } from '../../src/fetch_profile/metadata_query'

describe('flows filter', () => {
  let client: SalesforceClient
  let connection: MockInterface<Connection>
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let fetchMetadataInstancesSpy: jest.SpyInstance
  let flowType: ObjectType
  let flowDefinitionType: ObjectType

  beforeEach(() => {
    ;({ client, connection } = mockClient())
    connection.query.mockResolvedValue({
      records: [],
      done: true,
      totalSize: 0,
    })
    jest.spyOn(filterModule, 'createActiveVersionFileProperties')
    flowType = new ObjectType({
      elemID: new ElemID(SALESFORCE, FLOW_METADATA_TYPE),
      annotations: { [METADATA_TYPE]: FLOW_METADATA_TYPE },
    })
    flowDefinitionType = new ObjectType({
      elemID: new ElemID(SALESFORCE, FLOW_DEFINITION_METADATA_TYPE),
      annotations: { [METADATA_TYPE]: FLOW_DEFINITION_METADATA_TYPE },
    })
    fetchMetadataInstancesSpy = jest.spyOn(fetchModule, 'fetchMetadataInstances')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]
    let flowDefinitionInstance: InstanceElement

    describe('when Flow MetadataType is not in the fetch targets', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType, flowDefinitionInstance]
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              metadataQuery: buildMetadataQuery({
                fetchParams: {},
                targetedFetchInclude: await getMetadataIncludeFromFetchTargets(
                  [APEX_CLASS_METADATA_TYPE],
                  buildElementsSourceFromElements([]),
                ),
              }),
              fetchParams: {},
            }),
          },
          client,
        }) as typeof filter
        await filter.onFetch(elements)
      })
      it('should not fetch the Flow instances', async () => {
        expect(fetchMetadataInstancesSpy).not.toHaveBeenCalled()
      })
    })
    describe('when Flow MetadataType is in the fetch targets', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType, flowDefinitionInstance]
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              metadataQuery: buildMetadataQuery({
                fetchParams: {},
                targetedFetchInclude: await getMetadataIncludeFromFetchTargets(
                  [FLOW_METADATA_TYPE],
                  buildElementsSourceFromElements([]),
                ),
              }),
              fetchParams: {},
            }),
          },
          client,
        }) as typeof filter
        await filter.onFetch(elements)
      })
      it('should fetch the Flow instances', async () => {
        expect(fetchMetadataInstancesSpy).toHaveBeenCalled()
      })
    })
    describe('with preferActiveFlowVersions true', () => {
      beforeEach(async () => {
        flowDefinitionInstance = createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'flow1',
            [ACTIVE_VERSION_NUMBER]: 0,
          },
          flowDefinitionType,
        )
        elements = [flowType, flowDefinitionType, flowDefinitionInstance]
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: { preferActiveFlowVersions: true },
            }),
          },
          client,
        }) as typeof filter
        await filter.onFetch(elements)
      })

      it('should hide the FlowDefinition metadata type and instances', async () => {
        expect(flowDefinitionType.annotations[CORE_ANNOTATIONS.HIDDEN]).toBeTrue()
        expect(flowDefinitionInstance.annotations[CORE_ANNOTATIONS.HIDDEN]).toBeTrue()
      })

      it('Should call fetchMetadataInstances once', async () => {
        expect(fetchMetadataInstancesSpy).toHaveBeenCalledTimes(1)
      })
      it('should invoke createActiveVersionFileProperties with the FlowDefinition instances', async () => {
        expect(createActiveVersionFileProperties).toHaveBeenCalledWith({
          flowsFileProps: [],
          flowDefinitions: [flowDefinitionInstance],
          client,
          fetchProfile: expect.anything(),
        })
      })
    })
    describe('with preferActiveFlowVersions false', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType]
        fetchMetadataInstancesSpy = jest.spyOn(fetchModule, 'fetchMetadataInstances')
        filter = filterCreator({
          config: { ...defaultFilterContext },
          client,
        }) as typeof filter
        await filter.onFetch(elements)
      })

      it('Should call fetchMetadataInstances once', async () => {
        expect(fetchMetadataInstancesSpy).toHaveBeenCalledTimes(1)
      })
    })
    describe('find the active versions of the flows', () => {
      const FLOW2_ACTIVE_VERSION_INTERANL_ID = 'flow2-internal-id'
      const FLOW1_INTERNAL_ID = 'flow1-internal-id'
      const FLOW1_API_NAME = 'flow1'
      const FLOW2_API_NAME = 'flow2'

      const FLOW_DEFINITION1_INTERNAL_ID = 'flow-definition1-internal-id'
      const FLOW_DEFINITION2_INTERNAL_ID = 'flow-definition2-internal-id'
      let flowsFileProps: FileProperties[]
      let flowDefinitions: InstanceElement[]

      beforeEach(() => {
        flowsFileProps = [
          mockFileProperties({
            fullName: FLOW1_API_NAME,
            type: 'flow',
            createdByName: 'Ruler',
            createdDate: 'created_date',
            lastModifiedByName: 'Ruler',
            lastModifiedDate: '2021-10-19T06:30:10.000Z',
            id: FLOW1_INTERNAL_ID,
          }),
          mockFileProperties({
            fullName: FLOW2_API_NAME,
            type: 'flow',
            createdByName: 'Ruler',
            createdDate: 'created_date',
            lastModifiedByName: 'Ruler',
            lastModifiedDate: '2021-10-19T06:30:10.000Z',
          }),
        ]
        flowDefinitions = [
          createInstanceElement(
            { fullName: 'flow1', [INTERNAL_ID_FIELD]: FLOW_DEFINITION1_INTERNAL_ID },
            mockTypes.FlowDefinition,
          ),
          createInstanceElement(
            { fullName: 'flow2', activeVersionNumber: 2, [INTERNAL_ID_FIELD]: FLOW_DEFINITION2_INTERNAL_ID },
            mockTypes.FlowDefinition,
          ),
        ]
        connection.query.mockImplementation(async query => {
          const records: SalesforceRecord[] = []
          if (query.includes(FLOW_DEFINITION1_INTERNAL_ID)) {
            records.push({
              Id: FLOW_DEFINITION1_INTERNAL_ID,
              ActiveVersionId: null,
              ApiName: FLOW1_API_NAME,
            })
          }
          if (query.includes(FLOW_DEFINITION2_INTERNAL_ID)) {
            records.push({
              Id: FLOW_DEFINITION2_INTERNAL_ID,
              ActiveVersionId: FLOW2_ACTIVE_VERSION_INTERANL_ID,
              ApiName: FLOW2_API_NAME,
            })
          }
          return { records, done: true, totalSize: records.length }
        })
      })
      it('Should fetch the active flows with correct internal IDs', async () => {
        const result = await createActiveVersionFileProperties({
          flowsFileProps,
          flowDefinitions,
          client,
          fetchProfile: defaultFilterContext.fetchProfile,
        })
        expect(connection.query).toHaveBeenCalledTimes(1)
        expect(connection.query).toHaveBeenCalledWith(
          expect.stringContaining(`Id IN ('${FLOW_DEFINITION1_INTERNAL_ID}','${FLOW_DEFINITION2_INTERNAL_ID}')`),
        )
        expect(result[0].fullName).toEqual('flow1')
        expect(result[0].id).toEqual(FLOW1_INTERNAL_ID)
        expect(result[1].fullName).toEqual('flow2-2')
        expect(result[1].id).toEqual(FLOW2_ACTIVE_VERSION_INTERANL_ID)
      })
      it('should send multiple queries when the number of flow definitions exceeds the chunk size and return correct file properties', async () => {
        const result = await createActiveVersionFileProperties({
          flowsFileProps,
          flowDefinitions,
          client,
          fetchProfile: buildFetchProfile({ fetchParams: { limits: { flowDefinitionsQueryChunkSize: 1 } } }),
        })
        expect(connection.query).toHaveBeenCalledTimes(2)
        expect(connection.query).toHaveBeenCalledWith(
          expect.stringContaining(`Id IN ('${FLOW_DEFINITION1_INTERNAL_ID}')`),
        )
        expect(connection.query).toHaveBeenCalledWith(
          expect.stringContaining(`Id IN ('${FLOW_DEFINITION2_INTERNAL_ID}')`),
        )
        expect(result[0].fullName).toEqual('flow1')
        expect(result[0].id).toEqual(FLOW1_INTERNAL_ID)
        expect(result[1].fullName).toEqual('flow2-2')
        expect(result[1].id).toEqual(FLOW2_ACTIVE_VERSION_INTERANL_ID)
      })
    })
  })

  describe('preDeploy and onDeploy', () => {
    let changes: Change[]

    let alreadyInactiveFlowChange: Change<InstanceElement>
    let deactivatedFlowChange: Change<InstanceElement>
    let activeFlowChange: Change<InstanceElement>
    let newInactiveFlowChange: Change<InstanceElement>
    let deactivatedFlowChangeWithAdditionalChanges: Change<InstanceElement>
    let workflowChange: Change<InstanceElement>
    beforeEach(() => {
      filter = filterCreator({
        config: {
          ...defaultFilterContext,
          elementsSource: buildElementsSourceFromElements([flowDefinitionType]),
        },
        client,
      }) as typeof filter

      deactivatedFlowChange = createFlowChange({
        flowApiName: 'deactivated',
        beforeStatus: 'Active',
        afterStatus: 'Draft',
      })
      // These type of Flow changes should be ignored
      alreadyInactiveFlowChange = createFlowChange({
        flowApiName: 'alreadyInactive',
        beforeStatus: 'Obsolete',
        afterStatus: 'Draft',
      })
      activeFlowChange = createFlowChange({
        flowApiName: 'active',
        afterStatus: 'Active',
      })
      newInactiveFlowChange = createFlowChange({
        flowApiName: 'newInactive',
        afterStatus: 'Draft',
      })
      // Deactivating a Flow with additional changes should not be handled
      deactivatedFlowChangeWithAdditionalChanges = createFlowChange({
        flowApiName: 'notOnlyDeactivated',
        beforeStatus: 'Active',
        afterStatus: 'Draft',
        additionalModifications: true,
      })
      // Deactivating a non Flow instance should not be handled
      workflowChange = toChange({
        before: createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'workflow',
            [STATUS]: 'Active',
          },
          mockTypes.Workflow,
        ),
        after: createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: 'workflow',
            [STATUS]: 'Draft',
          },
          mockTypes.Workflow,
        ),
      })
      changes = [
        alreadyInactiveFlowChange,
        deactivatedFlowChange,
        activeFlowChange,
        newInactiveFlowChange,
        workflowChange,
        deactivatedFlowChangeWithAdditionalChanges,
      ]
    })
    it('should add FlowDefinition for flows that had been deactivated on preDeploy and remove them on onDeploy', async () => {
      await filter.preDeploy(changes)
      expect(changes).toIncludeSameMembers([
        alreadyInactiveFlowChange,
        deactivatedFlowChange,
        activeFlowChange,
        newInactiveFlowChange,
        deactivatedFlowChangeWithAdditionalChanges,
        workflowChange,
        expect.toSatisfy((change: Change) => {
          const instance = getChangeData(change)
          return (
            isInstanceOfTypeSync(FLOW_DEFINITION_METADATA_TYPE)(instance) &&
            apiNameSync(instance) === 'deactivated' &&
            instance.value[ACTIVE_VERSION_NUMBER] === 0
          )
        }),
      ])
      await filter.onDeploy(changes)
      expect(changes).toIncludeSameMembers([
        alreadyInactiveFlowChange,
        deactivatedFlowChange,
        activeFlowChange,
        newInactiveFlowChange,
        workflowChange,
        deactivatedFlowChangeWithAdditionalChanges,
      ])
    })
    describe('when the FlowDefinition MetadataType does not exist in the Elements source', () => {
      beforeEach(() => {
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            elementsSource: buildElementsSourceFromElements([]),
          },
          client,
        }) as typeof filter
      })
      it('should not add FlowDefinition for deactivatedFlows on preDeploy', async () => {
        await filter.preDeploy(changes)
        expect(changes).toIncludeSameMembers([
          alreadyInactiveFlowChange,
          deactivatedFlowChange,
          activeFlowChange,
          newInactiveFlowChange,
          workflowChange,
          deactivatedFlowChangeWithAdditionalChanges,
        ])
      })
    })
  })
})
