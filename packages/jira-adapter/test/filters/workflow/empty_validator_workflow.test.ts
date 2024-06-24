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
import { Change, getChangeData, InstanceElement, toChange } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import JiraClient from '../../../src/client/client'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import emptyValidatorFilter from '../../../src/filters/workflow/empty_validator_workflow'
import { createEmptyType, getFilterParams, mockClient } from '../../utils'

describe('empty validator workflow', () => {
  let filter: filterUtils.FilterWith<'preDeploy'>
  let client: JiraClient
  let changes: Change<InstanceElement>[]
  beforeEach(async () => {
    const { client: cli, paginator } = mockClient()
    client = cli
    filter = emptyValidatorFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as typeof filter
  })
  describe('workflowV1', () => {
    let workflowInstance: InstanceElement
    beforeEach(() => {
      workflowInstance = new InstanceElement('instance', createEmptyType(WORKFLOW_TYPE_NAME), {
        transitions: {
          tran1: {
            name: 'tran1',
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
        },
      })
      changes = [toChange({ after: workflowInstance })]
    })
    describe('preDeploy', () => {
      it('should remove empty validators from workflow transitions but keep add on ones', async () => {
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).value.transitions.tran1.rules.validators).toEqual([
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
        workflowInstance.value.transitions.tran1.rules.validators.pop()
        expect(getChangeData(changes[0]).value.transitions.tran1.rules.validators).toEqual([
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
  describe('workflowV2', () => {
    let workflowV2Instance: InstanceElement
    beforeEach(() => {
      workflowV2Instance = new InstanceElement('workflowV2Instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
        name: 'workflowV2Instance',
        version: {
          versionNumber: 1,
          id: 'id',
        },
        id: 'id',
        scope: {
          project: 'project',
          type: 'type',
        },
        statuses: [],
        transitions: {
          tran1: {
            name: 'tran1',
            id: 'id',
            type: 'Directed',
            validators: [
              {
                ruleKey: 'ruleKey',
                parameters: {
                  ruleType: 'fieldHasSingleValue',
                  fieldKey: 'fieldKey',
                },
              },
              {
                ruleKey: 'ruleKey',
                parameters: {
                  ruleType: 'addonType',
                },
              },
              {
                ruleKey: 'ruleKey',
                parameters: {
                  ruleType: 'fieldHasSingleValue',
                },
              },
            ],
          },
        },
      })
      changes = [toChange({ after: workflowV2Instance })]
    })
    describe('preDeploy', () => {
      it('should remove empty validators from workflow transitions but keep add on ones', async () => {
        await filter.preDeploy(changes)
        expect(getChangeData(changes[0]).value.transitions.tran1.validators).toEqual([
          {
            ruleKey: 'ruleKey',
            parameters: {
              ruleType: 'fieldHasSingleValue',
              fieldKey: 'fieldKey',
            },
          },
          {
            ruleKey: 'ruleKey',
            parameters: {
              ruleType: 'addonType',
            },
          },
        ])
      })
      it('should not change valid validators', async () => {
        workflowV2Instance.value.transitions.tran1.validators.pop()
        expect(getChangeData(changes[0]).value.transitions.tran1.validators).toEqual([
          {
            ruleKey: 'ruleKey',
            parameters: {
              ruleType: 'fieldHasSingleValue',
              fieldKey: 'fieldKey',
            },
          },
          {
            ruleKey: 'ruleKey',
            parameters: {
              ruleType: 'addonType',
            },
          },
        ])
      })
    })
  })
})
