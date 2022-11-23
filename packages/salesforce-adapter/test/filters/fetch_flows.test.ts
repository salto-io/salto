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
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import { defaultFilterContext } from '../utils'
import mockClient from '../client'
import fetchFlowFilter, { createActiveVersionFileProperties } from '../../src/filters/fetch_flows'
import {
  FLOW_DEFINITION_METADATA_TYPE,
  FLOW_METADATA_TYPE,
  METADATA_TYPE,
  SALESFORCE,
} from '../../src/constants'
import { mockFileProperties } from '../connection'
import { createInstanceElement } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'
import * as fetchModule from '../../src/fetch'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

describe('fetch flows filter', () => {
  const { client } = mockClient()
  let filter: FilterWith<'onFetch'>
  let fetchMetadataInstancesSpy: jest.SpyInstance

  beforeAll(() => {
    fetchMetadataInstancesSpy = jest.spyOn(fetchModule, 'fetchMetadataInstances')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]
    const flowType = new ObjectType({
      elemID: new ElemID(SALESFORCE, FLOW_METADATA_TYPE),
      annotations: { [METADATA_TYPE]: FLOW_METADATA_TYPE },
    })
    const flowDefinitionType = new ObjectType({
      elemID: new ElemID(SALESFORCE, FLOW_DEFINITION_METADATA_TYPE),
      annotations: { [METADATA_TYPE]: FLOW_DEFINITION_METADATA_TYPE },
    })
    describe('with preferActiveFlowVersions true', () => {
      beforeAll(async () => {
        elements = [flowType, flowDefinitionType]
        filter = fetchFlowFilter(
          { config: { ...defaultFilterContext,
            fetchProfile: buildFetchProfile({ preferActiveFlowVersions: true }) },
          client },
        ) as FilterWith<'onFetch'>
        await filter.onFetch(elements)
      })

      it('Should call fetchMetadataInstances once', async () => {
        expect(fetchMetadataInstancesSpy).toHaveBeenCalledTimes(2)
      })
    })
    describe('with preferActiveFlowVersions false', () => {
      beforeAll(async () => {
        elements = [flowType, flowDefinitionType]
        fetchMetadataInstancesSpy = jest.spyOn(fetchModule, 'fetchMetadataInstances')
        filter = fetchFlowFilter(
          { config: { ...defaultFilterContext }, client },
        ) as FilterWith<'onFetch'>
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
        const flowdef1 = createInstanceElement({ fullName: 'flow1' },
          mockTypes.FlowDefinition)
        const flowdef2 = createInstanceElement({ fullName: 'flow2', activeVersionNumber: 2 },
          mockTypes.FlowDefinition)
        const result = createActiveVersionFileProperties(
          [mockedFileProperties1, mockedFileProperties2],
          [flowdef1, flowdef2]
        )
        expect(result[0].fullName).toEqual('flow1')
        expect(result[1].fullName).toEqual('flow2-2')
      })
    })
  })
})
