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
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { Change, getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/deploy_flows'
import { defaultFilterContext } from '../utils'
import mockClient from '../client'
import { createInstanceElement } from '../../src/transformers/transformer'
import { mockTypes } from '../mock_elements'

describe('deployFlowsFilter', () => {
  const { client } = mockClient()
  let filter: FilterWith<'preDeploy'>
  let flowChanges: Change<InstanceElement>[]
  const beforeRecord = createInstanceElement({ fullName: 'flow2', status: 'Active', actionType: 'quick' }, mockTypes.Flow)
  const afterRecord = beforeRecord.clone()

  afterRecord.value.actionType = 'case'
  beforeEach(() => {
    flowChanges = [toChange({ before: beforeRecord.clone(), after: afterRecord.clone() }),
      toChange({ after: afterRecord.clone() })]
  })
  describe('enableFlowDeployAsActiveEnabled is off', () => {
    const flowSettings = createInstanceElement({ fullName: '',
      enableFlowDeployAsActiveEnabled: false }, mockTypes.FlowSettings)
    const elementsSource = buildElementsSourceFromElements([flowSettings])
    beforeEach(async () => {
      filter = filterCreator({
        config: { ...defaultFilterContext, elementsSource },
        client,
      }) as FilterWith<'preDeploy'>
      await filter.preDeploy(flowChanges)
    })
    it('should convert the flows to be inactive', () => {
      expect(getChangeData(flowChanges[0]).value.status).toBe('Draft')
      expect(getChangeData(flowChanges[1]).value.status).toBe('Draft')
    })
  })
  describe('enableFlowDeployAsActiveEnabled is on', () => {
    const flowSettings = createInstanceElement({ fullName: '',
      enableFlowDeployAsActiveEnabled: true }, mockTypes.FlowSettings)
    const elementsSource = buildElementsSourceFromElements([flowSettings])
    beforeAll(async () => {
      filter = filterCreator({
        config: { ...defaultFilterContext, elementsSource },
        client,
      }) as FilterWith<'preDeploy'>
      await filter.preDeploy(flowChanges)
    })
    it('should not change the flows', () => {
      expect(getChangeData(flowChanges[0]).value.status).toBe('Active')
      expect(getChangeData(flowChanges[1]).value.status).toBe('Active')
    })
  })
})
