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
import { Change, ElemID, getChangeData, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../../src/client/client'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import emptyValidatorFilter from '../../../src/filters/workflow/empty_validator_workflow'
import { getFilterParams, mockClient } from '../../utils'

describe('empty validator workflow', () => {
  let filter: filterUtils.FilterWith<'preDeploy'>
  let workflowType: ObjectType
  let workflowInstance: InstanceElement
  let client: JiraClient
  let changes: Change<InstanceElement>[]
  beforeEach(async () => {
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
    })
    workflowInstance = new InstanceElement(
      'instance',
      workflowType,
      {
        transitions: [
          {
            rules: {
              validators: [
                {
                  type: 'FieldChangedValidator',
                  configuration: {
                    key: 'value',
                  },
                },
                {
                  type: 'add_on_type_with_no_configuration',
                },
                {
                  type: 'FieldHasSingleValueValidator',
                },
              ],
            },
          },
        ],
      },
    )

    const { client: cli, paginator } = mockClient()
    changes = [toChange({ after: workflowInstance })]
    client = cli
    filter = emptyValidatorFilter(getFilterParams({
      client,
      paginator,
    })) as typeof filter
  })

  describe('preDeploy', () => {
    it('should remove empty validators from workflow transitions but keep add on ones', async () => {
      await filter.preDeploy(changes)
      expect(getChangeData(changes[0]).value.transitions[0].rules.validators).toEqual([
        {
          type: 'FieldChangedValidator',
          configuration: {
            key: 'value',
          },
        },
        {
          type: 'add_on_type_with_no_configuration',
        },
      ])
    })

    it('should not change valid validators', async () => {
      workflowInstance.value.transitions[0].rules.validators.pop()
      expect(getChangeData(changes[0]).value.transitions[0].rules.validators).toEqual([
        {
          type: 'FieldChangedValidator',
          configuration: {
            key: 'value',
          },
        },
        {
          type: 'add_on_type_with_no_configuration',
        },
      ])
    })
  })
})
