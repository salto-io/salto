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
import { toChange, ObjectType, ElemID, InstanceElement, ChangeDataType, Change } from '@salto-io/adapter-api'
import { emptyValidatorWorkflowChangeValidator } from '../../../src/change_validators/workflows/empty_validator_workflow'
import { JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'

describe('workflowPropertiesValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  let changes: ReadonlyArray<Change<ChangeDataType>>

  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })
    instance = new InstanceElement(
      'instance',
      type,
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
    changes = [toChange({ after: instance })]
  })
  it('should return an error if there are invalid validators', async () => {
    expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Invalid workflow transition validator won’t be deployed',
        detailedMessage: 'This workflow has a FieldHasSingleValueValidator transition validator, which is missing some configuration. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its configuration',
      },
    ])
  })
  it('should return an plural error if there are multiple invalid validators', async () => {
    instance.value.transitions[0].rules.validators.push({
      type: 'PreviousStatusValidator',
    })
    expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Invalid workflow transition validator won’t be deployed',
        detailedMessage: 'This workflow has the following transition validators FieldHasSingleValueValidator, PreviousStatusValidator, which are missing some configuration. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its configuration',
      },
    ])
  })
  it('should return an plural error if there are multiple invalid validators but only once per type', async () => {
    instance.value.transitions[0].rules.validators.push({
      type: 'FieldHasSingleValueValidator',
    })
    expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Warning',
        message: 'Invalid workflow transition validator won’t be deployed',
        detailedMessage: 'This workflow has a FieldHasSingleValueValidator transition validator, which is missing some configuration. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its configuration',
      },
    ])
  })
  it('should not return an error if workflow has only valid validator', async () => {
    instance.value.transitions[0].rules.validators.pop()
    expect(await emptyValidatorWorkflowChangeValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })

  it('should not return an error when there are no validators', async () => {
    delete instance.value.transitions[0].rules
    expect(await emptyValidatorWorkflowChangeValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })

  it('should not return an error when there are no rules', async () => {
    delete instance.value.transitions[0]
    expect(await emptyValidatorWorkflowChangeValidator([
      toChange({
        after: instance,
      }),
    ])).toEqual([])
  })

  it('should not return an error when workflow is removed', async () => {
    expect(await emptyValidatorWorkflowChangeValidator([
      toChange({
        before: instance,
      }),
    ])).toEqual([])
  })
})
