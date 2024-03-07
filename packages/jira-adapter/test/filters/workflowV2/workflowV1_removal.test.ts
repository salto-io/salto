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
import _ from 'lodash'
import { InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { FilterResult } from '../../../src/filter'
import workflowV1RemovalFilter from '../../../src/filters/workflowV2/workflowV1_removal'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../src/constants'

describe('workflow filter', () => {
  describe('on fetch', () => {
    let filter: filterUtils.FilterWith<'onFetch', FilterResult>
    let config: JiraConfig
    let workflowType: ObjectType
    let elements: Element[]
    let workflowV1Instance1: InstanceElement
    let workflowV1Instance2: InstanceElement
    let workflowV2Instance: InstanceElement
    let notWorkflowInstance: InstanceElement

    beforeEach(async () => {
      jest.clearAllMocks()
      workflowType = createEmptyType(WORKFLOW_TYPE_NAME)
      workflowV1Instance1 = new InstanceElement('workflowV1Instance1', workflowType, {})
      workflowV1Instance2 = new InstanceElement('workflowV1Instance2', workflowType, {})
      workflowV2Instance = new InstanceElement('workflowV2Instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {})
      notWorkflowInstance = new InstanceElement('notWorkflowInstance', createEmptyType('notWorkflowType'), {})
      elements = [workflowType, workflowV1Instance1, workflowV1Instance2, workflowV2Instance, notWorkflowInstance]
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    })

    it('should remove workflowV1 instances when enableNewWorkflowAPI is true', async () => {
      config.fetch.enableNewWorkflowAPI = true
      filter = workflowV1RemovalFilter(
        getFilterParams({
          config,
        }),
      ) as typeof filter
      await filter.onFetch(elements)
      expect(elements).toHaveLength(2)
      expect(elements).toEqual([workflowV2Instance, notWorkflowInstance])
    })

    it('should not remove workflowV1 instances when enableNewWorkflowAPI is false', async () => {
      config.fetch.enableNewWorkflowAPI = false
      filter = workflowV1RemovalFilter(
        getFilterParams({
          config,
        }),
      ) as typeof filter
      await filter.onFetch(elements)
      expect(elements).toHaveLength(5)
      expect(elements).toEqual([
        workflowType,
        workflowV1Instance1,
        workflowV1Instance2,
        workflowV2Instance,
        notWorkflowInstance,
      ])
    })
  })
})
