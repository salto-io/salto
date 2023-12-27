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
import _ from 'lodash'
import { InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { FilterResult } from '../../../src/filter'
import conditionReferenceFilter from '../../../src/filters/workflowV2/condition_reference_filter'
import { createEmptyType, getFilterParams } from '../../utils'
import { getDefaultConfig } from '../../../src/config/config'
import { JIRA_WORKFLOW_TYPE } from '../../../src/constants'

describe('workflowFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch', FilterResult>
  let workflowType: ObjectType
  let instance: InstanceElement
  beforeEach(async () => {
    workflowType = createEmptyType(JIRA_WORKFLOW_TYPE)
    const config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableNewWorkflowAPI = true
    filter = conditionReferenceFilter(getFilterParams({
      config,
    })) as typeof filter
  })

  describe('onFetch', () => {
    describe('when the rule is restrict issues', () => {
      beforeEach(async () => {
        instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              conditions: {
                conditions: [
                  {
                    ruleKey: 'system:restrict-issue-transition',
                    parameters: {
                      roleIds: '1,2',
                      groupIds: '3',
                      groupCustomFieldIds: '',
                    },
                  },
                ],
              },
            },
          ],
        })
        await filter.onFetch([instance])
      })
      it('should convert ids string to list', async () => {
        const { parameters } = instance.value.transitions[0].conditions.conditions[0]
        expect(parameters.roleIds).toEqual(
          ['1', '2'],
        )
        expect(parameters.groupIds).toEqual(
          ['3'],
        )
      })
      it('should delete fields with empty string', async () => {
        const { parameters } = instance.value.transitions[0].conditions.conditions[0]
        expect(parameters.groupCustomFieldIds).toBeUndefined()
      })
    })
    describe('when the rule is blocking condition', () => {
      beforeEach(async () => {
        instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              conditions: {
                conditions: [
                  {
                    ruleKey: 'system:parent-or-child-blocking-condition',
                    parameters: {
                      statusIds: '1,2',
                    },
                  },
                ],
              },
            },
          ],
        })
        await filter.onFetch([instance])
      })
      it('should convert ids string to list', async () => {
        const { parameters } = instance.value.transitions[0].conditions.conditions[0]
        expect(parameters.statusIds).toEqual(
          ['1', '2'],
        )
      })
    })
    describe('when the rule is not restrict issues nor blocking condition', () => {
      beforeEach(async () => {
        instance = new InstanceElement('instance', workflowType, {
          transitions: [
            {
              conditions: {
                conditions: [
                  {
                    ruleKey: 'Quack!!',
                    parameters: {
                      groupIds: '3',
                    },
                  },
                ],
              },
            },
          ],
        })
        await filter.onFetch([instance])
      })
      it('should not convert ids', async () => {
        const { parameters } = instance.value.transitions[0].conditions.conditions[0]
        expect(parameters.groupIds).toEqual('3')
      })
    })
  })
})
