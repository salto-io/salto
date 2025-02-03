/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  CORE_ANNOTATIONS,
  Element,
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
import filterCreator from '../../src/filters/flows_filter'
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
import * as filterUtils from '../../src/filters/utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { FilterWith } from './mocks'
import { SalesforceClient } from '../../index'
import { apiNameSync, getMetadataIncludeFromFetchTargets, isInstanceOfTypeSync } from '../../src/filters/utils'
import Connection from '../../src/client/jsforce'
import { buildMetadataQuery } from '../../src/fetch_profile/metadata_query'
import { SalesforceRecord } from '../../src/client/types'

describe('flows filter', () => {
  let client: SalesforceClient
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  const flowType = new ObjectType({
    elemID: new ElemID(SALESFORCE, FLOW_METADATA_TYPE),
    annotations: { [METADATA_TYPE]: FLOW_METADATA_TYPE },
  })
  const flowDefinitionType = new ObjectType({
    elemID: new ElemID(SALESFORCE, FLOW_DEFINITION_METADATA_TYPE),
    annotations: { [METADATA_TYPE]: FLOW_DEFINITION_METADATA_TYPE },
  })

  describe('onFetch', () => {
    let connection: MockInterface<Connection>
    let listMetadataObjectsSpy: jest.SpyInstance
    let fetchMetadataInstancesSpy: jest.SpyInstance
    let flowDefinitionInstances: InstanceElement[]
    let elements: Element[]

    const FLOW1_API_NAME = 'flow1' // Latest version draft
    const FLOW2_API_NAME = 'flow2' // Latest version active
    const FLOW3_API_NAME = 'flow3' // No active version
    const FLOW1_INTERNAL_ID = 'flow1-internal-id'
    const FLOW2_INTERNAL_ID = 'flow2-internal-id'
    const FLOW3_INTERNAL_ID = 'flow3-internal-id'
    const FLOW1_DEFINITION_INTERNAL_ID = 'flow1-definition-internal-id'
    const FLOW2_DEFINITION_INTERNAL_ID = 'flow2-definition-internal-id'
    const FLOW3_DEFINITION_INTERNAL_ID = 'flow3-definition-internal-id'
    const FLOW_VERSION_RECORDS: SalesforceRecord[] = [
      {
        Id: FLOW1_INTERNAL_ID,
        DefinitionId: FLOW1_DEFINITION_INTERNAL_ID,
        VersionNumber: 1,
        Status: 'Obsolete',
        CreatedDate: '2025-01-01T01:01:00.000Z',
        CreatedBy: {
          Name: 'Flow1 version 1 creator',
        },
        LastModifiedDate: '2025-01-02T01:01:00.000Z',
        LastModifiedBy: {
          Name: 'Flow1 version 1 modifier',
        },
      },
      {
        Id: FLOW1_INTERNAL_ID,
        DefinitionId: FLOW1_DEFINITION_INTERNAL_ID,
        VersionNumber: 2,
        Status: 'Active',
        CreatedDate: '2025-01-01T01:02:00.000Z',
        CreatedBy: {
          Name: 'Flow1 version 2 creator',
        },
        LastModifiedDate: '2025-01-02T01:02:00.000Z',
        LastModifiedBy: {
          Name: 'Flow1 version 2 modifier',
        },
      },
      {
        Id: FLOW1_INTERNAL_ID,
        DefinitionId: FLOW1_DEFINITION_INTERNAL_ID,
        VersionNumber: 3,
        Status: 'Draft',
        CreatedDate: '2025-01-01T01:03:00.000Z',
        CreatedBy: {
          Name: 'Flow1 version 3 creator',
        },
        LastModifiedDate: '2025-01-02T01:03:00.000Z',
        LastModifiedBy: {
          Name: 'Flow1 version 3 modifier',
        },
      },
      {
        Id: FLOW2_INTERNAL_ID,
        DefinitionId: FLOW2_DEFINITION_INTERNAL_ID,
        VersionNumber: 1,
        Status: 'Obsolete',
        CreatedDate: '2025-01-01T02:01:00.000Z',
        CreatedBy: {
          Name: 'Flow2 version 1 creator',
        },
        LastModifiedDate: '2025-01-02T02:01:00.000Z',
        LastModifiedBy: {
          Name: 'Flow2 version 1 modifier',
        },
      },
      {
        Id: FLOW2_INTERNAL_ID,
        DefinitionId: FLOW2_DEFINITION_INTERNAL_ID,
        VersionNumber: 2,
        Status: 'Active',
        CreatedDate: '2025-01-01T02:02:00.000Z',
        CreatedBy: {
          Name: 'Flow2 version 2 creator',
        },
        LastModifiedDate: '2025-01-02T02:02:00.000Z',
        LastModifiedBy: {
          Name: 'Flow2 version 2 modifier',
        },
      },
      {
        Id: FLOW3_INTERNAL_ID,
        DefinitionId: FLOW3_DEFINITION_INTERNAL_ID,
        VersionNumber: 1,
        Status: 'Draft',
        CreatedDate: '2025-01-01T03:01:00.000Z',
        CreatedBy: {
          Name: 'Flow3 version 1 creator',
        },
        LastModifiedDate: '2025-01-02T03:01:00.000Z',
        LastModifiedBy: {
          Name: 'Flow3 version 1 modifier',
        },
      },
    ]

    beforeEach(() => {
      ;({ client, connection } = mockClient())
      flowDefinitionInstances = [
        createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: FLOW1_API_NAME,
            [INTERNAL_ID_FIELD]: FLOW1_DEFINITION_INTERNAL_ID,
            [ACTIVE_VERSION_NUMBER]: 2,
          },
          flowDefinitionType,
        ),
        createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: FLOW2_API_NAME,
            [INTERNAL_ID_FIELD]: FLOW2_DEFINITION_INTERNAL_ID,
            [ACTIVE_VERSION_NUMBER]: 2,
          },
          flowDefinitionType,
        ),
        createInstanceElement(
          {
            [INSTANCE_FULL_NAME_FIELD]: FLOW3_API_NAME,
            [INTERNAL_ID_FIELD]: FLOW3_DEFINITION_INTERNAL_ID,
            [ACTIVE_VERSION_NUMBER]: 0,
          },
          flowDefinitionType,
        ),
      ]
      listMetadataObjectsSpy = jest.spyOn(filterUtils, 'listMetadataObjects')
      listMetadataObjectsSpy.mockReturnValueOnce({
        configChanges: [],
        elements: [
          mockFileProperties({
            type: FLOW_METADATA_TYPE,
            fullName: FLOW1_API_NAME,
          }),
          mockFileProperties({
            type: FLOW_METADATA_TYPE,
            fullName: FLOW2_API_NAME,
          }),
          mockFileProperties({
            type: FLOW_METADATA_TYPE,
            fullName: FLOW3_API_NAME,
          }),
        ],
      })
      fetchMetadataInstancesSpy = jest.spyOn(fetchModule, 'fetchMetadataInstances')
      fetchMetadataInstancesSpy.mockImplementation(
        async ({
          fileProps,
        }: {
          fileProps: FileProperties[]
        }): ReturnType<typeof fetchModule.fetchMetadataInstances> => ({
          configChanges: [],
          elements: fileProps.map(
            props =>
              new InstanceElement(props.fullName, flowType, { [INSTANCE_FULL_NAME_FIELD]: props.fullName }, undefined, {
                [CORE_ANNOTATIONS.CREATED_BY]: props.createdByName,
                [CORE_ANNOTATIONS.CREATED_AT]: props.createdDate,
                [CORE_ANNOTATIONS.CHANGED_BY]: props.lastModifiedByName,
                [CORE_ANNOTATIONS.CHANGED_AT]: props.lastModifiedDate,
              }),
          ),
        }),
      )
      connection.tooling.query.mockImplementation(async query => {
        const records = FLOW_VERSION_RECORDS.filter(record => query.includes(record.DefinitionId))
        return {
          records,
          done: true,
          totalSize: records.length,
        }
      })
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    describe('when Flow MetadataType is not in the fetch targets', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType, ...flowDefinitionInstances]
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
        expect(listMetadataObjectsSpy).not.toHaveBeenCalled()
        expect(fetchMetadataInstancesSpy).not.toHaveBeenCalled()
        expect(connection.tooling.query).not.toHaveBeenCalled()
        expect(elements.filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))).toBeEmpty()
      })
    })

    describe('when Flow MetadataType is in the fetch targets', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType, ...flowDefinitionInstances]
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
        expect(listMetadataObjectsSpy).toHaveBeenCalled()
        expect(fetchMetadataInstancesSpy).toHaveBeenCalled()
        expect(elements.filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))).toHaveLength(3)
      })
    })

    describe('with preferActiveFlowVersions true', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType, ...flowDefinitionInstances]
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

      it('should hide FlowDefinition instances', async () => {
        expect(flowDefinitionInstances).toSatisfyAll(inst => inst.annotations[CORE_ANNOTATIONS.HIDDEN])
      })

      it('should call client methods once', async () => {
        expect(listMetadataObjectsSpy).toHaveBeenCalledTimes(1)
        expect(fetchMetadataInstancesSpy).toHaveBeenCalledTimes(1)
        expect(connection.tooling.query).toHaveBeenCalledTimes(1)
      })

      it('should populate flows with the active version information', () => {
        expect(elements.filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))).toIncludeAllPartialMembers([
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW1_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow1 version 2 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T01:02:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow1 version 2 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T01:02:00.000Z',
            },
          },
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW2_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow2 version 2 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T02:02:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow2 version 2 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T02:02:00.000Z',
            },
          },
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW3_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow3 version 1 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T03:01:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow3 version 1 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T03:01:00.000Z',
            },
          },
        ])
      })
    })

    describe('with preferActiveFlowVersions false', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType, ...flowDefinitionInstances]
        fetchMetadataInstancesSpy = jest.spyOn(fetchModule, 'fetchMetadataInstances')
        filter = filterCreator({
          config: defaultFilterContext,
          client,
        }) as typeof filter
        await filter.onFetch(elements)
      })

      it('should hide FlowDefinition instances', async () => {
        expect(flowDefinitionInstances).toSatisfyAll(inst => inst.annotations[CORE_ANNOTATIONS.HIDDEN])
      })

      it('should call client methods once', async () => {
        expect(listMetadataObjectsSpy).toHaveBeenCalledTimes(1)
        expect(fetchMetadataInstancesSpy).toHaveBeenCalledTimes(1)
        expect(connection.tooling.query).toHaveBeenCalledTimes(1)
      })

      it('should populate flows with the active version information', () => {
        expect(elements.filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))).toIncludeAllPartialMembers([
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW1_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow1 version 3 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T01:03:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow1 version 3 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T01:03:00.000Z',
            },
          },
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW2_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow2 version 2 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T02:02:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow2 version 2 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T02:02:00.000Z',
            },
          },
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW3_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow3 version 1 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T03:01:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow3 version 1 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T03:01:00.000Z',
            },
          },
        ])
      })
    })

    describe('with more flow definitions than the chunk size', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType, ...flowDefinitionInstances]
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: { limits: { flowDefinitionsQueryChunkSize: 1 } },
            }),
          },
          client,
        }) as typeof filter
        await filter.onFetch(elements)
      })

      it('should call client methods the right number of times', async () => {
        expect(listMetadataObjectsSpy).toHaveBeenCalledTimes(1)
        expect(fetchMetadataInstancesSpy).toHaveBeenCalledTimes(1)
        expect(connection.tooling.query).toHaveBeenCalledTimes(3)
      })

      it('should populate flows with the active version information', () => {
        expect(elements.filter(isInstanceOfTypeSync(FLOW_METADATA_TYPE))).toIncludeAllPartialMembers([
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW1_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow1 version 3 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T01:03:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow1 version 3 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T01:03:00.000Z',
            },
          },
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW2_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow2 version 2 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T02:02:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow2 version 2 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T02:02:00.000Z',
            },
          },
          {
            value: {
              [INSTANCE_FULL_NAME_FIELD]: FLOW3_API_NAME,
            },
            annotations: {
              [CORE_ANNOTATIONS.CREATED_BY]: 'Flow3 version 1 creator',
              [CORE_ANNOTATIONS.CREATED_AT]: '2025-01-01T03:01:00.000Z',
              [CORE_ANNOTATIONS.CHANGED_BY]: 'Flow3 version 1 modifier',
              [CORE_ANNOTATIONS.CHANGED_AT]: '2025-01-02T03:01:00.000Z',
            },
          },
        ])
      })
    })

    describe('when Flows are excluded', () => {
      beforeEach(async () => {
        elements = [flowDefinitionType, ...flowDefinitionInstances]
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                metadata: { exclude: [{ metadataType: FLOW_METADATA_TYPE }] },
              },
            }),
            elementsSource: buildElementsSourceFromElements([flowDefinitionType]),
          },
          client,
        }) as typeof filter
        await filter.onFetch(elements)
      })

      it('should hide FlowDefinition instances', () => {
        expect(flowDefinitionInstances).toSatisfyAll(inst => inst.annotations[CORE_ANNOTATIONS.HIDDEN])
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
