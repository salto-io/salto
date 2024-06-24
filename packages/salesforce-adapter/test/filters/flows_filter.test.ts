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
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { defaultFilterContext } from '../utils'
import mockClient from '../client'
import filterCreator, {
  createActiveVersionFileProperties,
} from '../../src/filters/flows_filter'
import * as filterModule from '../../src/filters/flows_filter'
import {
  ACTIVE_VERSION_NUMBER,
  FLOW_DEFINITION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
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
import { apiNameSync, isInstanceOfTypeSync } from '../../src/filters/utils'

describe('flows filter', () => {
  let client: SalesforceClient
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>
  let fetchMetadataInstancesSpy: jest.SpyInstance
  let flowType: ObjectType
  let flowDefinitionType: ObjectType

  beforeEach(() => {
    jest.spyOn(filterModule, 'createActiveVersionFileProperties')
    client = mockClient().client
    flowType = new ObjectType({
      elemID: new ElemID(SALESFORCE, FLOW_METADATA_TYPE),
      annotations: { [METADATA_TYPE]: FLOW_METADATA_TYPE },
    })
    flowDefinitionType = new ObjectType({
      elemID: new ElemID(SALESFORCE, FLOW_DEFINITION_METADATA_TYPE),
      annotations: { [METADATA_TYPE]: FLOW_DEFINITION_METADATA_TYPE },
    })
    fetchMetadataInstancesSpy = jest.spyOn(
      fetchModule,
      'fetchMetadataInstances',
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]
    let flowDefinitionInstance: InstanceElement
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
        expect(
          flowDefinitionType.annotations[CORE_ANNOTATIONS.HIDDEN],
        ).toBeTrue()
        expect(
          flowDefinitionInstance.annotations[CORE_ANNOTATIONS.HIDDEN],
        ).toBeTrue()
      })

      it('Should call fetchMetadataInstances once', async () => {
        expect(fetchMetadataInstancesSpy).toHaveBeenCalledTimes(1)
      })
      it('should invoke createActiveVersionFileProperties with the FlowDefinition instances', async () => {
        expect(createActiveVersionFileProperties).toHaveBeenCalledWith(
          expect.anything(),
          [flowDefinitionInstance],
        )
      })
    })
    describe('with preferActiveFlowVersions false', () => {
      beforeEach(async () => {
        elements = [flowType, flowDefinitionType]
        fetchMetadataInstancesSpy = jest.spyOn(
          fetchModule,
          'fetchMetadataInstances',
        )
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
      it('Should fetch the active flows', async () => {
        const mockedFileProperties1 = mockFileProperties({
          fullName: 'flow1',
          type: 'flow',
          createdByName: 'Ruler',
          createdDate: 'created_date',
          lastModifiedByName: 'Ruler',
          lastModifiedDate: '2021-10-19T06:30:10.000Z',
        })
        const mockedFileProperties2 = mockFileProperties({
          fullName: 'flow2',
          type: 'flow',
          createdByName: 'Ruler',
          createdDate: 'created_date',
          lastModifiedByName: 'Ruler',
          lastModifiedDate: '2021-10-19T06:30:10.000Z',
        })
        const flowDef1 = createInstanceElement(
          { fullName: 'flow1' },
          mockTypes.FlowDefinition,
        )
        const flowDef2 = createInstanceElement(
          { fullName: 'flow2', activeVersionNumber: 2 },
          mockTypes.FlowDefinition,
        )
        const result = createActiveVersionFileProperties(
          [mockedFileProperties1, mockedFileProperties2],
          [flowDef1, flowDef2],
        )
        expect(result[0].fullName).toEqual('flow1')
        expect(result[1].fullName).toEqual('flow2-2')
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
