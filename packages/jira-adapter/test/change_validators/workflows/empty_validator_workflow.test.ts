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
import { toChange, InstanceElement, ChangeDataType, Change } from '@salto-io/adapter-api'
import { emptyValidatorWorkflowChangeValidator } from '../../../src/change_validators/workflows/empty_validator_workflow'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { createEmptyType } from '../../utils'

describe('emptyValidatorWorkflow', () => {
  let changes: ReadonlyArray<Change<ChangeDataType>>
  describe('workflowV1', () => {
    let instance: InstanceElement
    beforeEach(() => {
      instance = new InstanceElement('instance', createEmptyType(WORKFLOW_TYPE_NAME), {
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
      changes = [toChange({ after: instance })]
    })
    it('should return an error if there are invalid validators', async () => {
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
        {
          elemID: instance.elemID,
          severity: 'Warning',
          message: 'Invalid workflow transition validator won’t be deployed',
          detailedMessage:
            'This workflow has a FieldHasSingleValueValidator transition validator, which is missing some configuration. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its configuration',
        },
      ])
    })
    it('should return a singular error if there are multiple invalid validators', async () => {
      instance.value.transitions.tran1.rules.validators.push({
        type: 'PreviousStatusValidator',
      })
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
        {
          elemID: instance.elemID,
          severity: 'Warning',
          message: 'Invalid workflow transition validator won’t be deployed',
          detailedMessage:
            'This workflow has the following transition validators FieldHasSingleValueValidator, PreviousStatusValidator, which are missing some configuration. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its configuration',
        },
      ])
    })
    it('should return a singular error if there are multiple invalid validators but only one type', async () => {
      instance.value.transitions.tran1.rules.validators.push({
        type: 'FieldHasSingleValueValidator',
      })
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
        {
          elemID: instance.elemID,
          severity: 'Warning',
          message: 'Invalid workflow transition validator won’t be deployed',
          detailedMessage:
            'This workflow has a FieldHasSingleValueValidator transition validator, which is missing some configuration. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its configuration',
        },
      ])
    })
    it('should not return an error if workflow has only valid validator', async () => {
      instance.value.transitions.tran1.rules.validators.pop()
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([])
    })

    it('should not return an error when there are no validators', async () => {
      delete instance.value.transitions.tran1.rules.validators
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([])
    })

    it('should not return an error when there are no rules', async () => {
      delete instance.value.transitions.tran1.rules
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([])
    })

    it('should not return an error when workflow is removed', async () => {
      expect(await emptyValidatorWorkflowChangeValidator([toChange({ before: instance })])).toEqual([])
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
            type: 'DIRECTED',
            validators: [
              {
                parameters: {
                  ruleType: 'fieldHasSingleValue',
                  fieldKey: 'fieldKey',
                },
              },
              {
                parameters: {
                  ruleType: 'anotherType',
                },
              },
              {
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
    it('should return an error if there are invalid validators', async () => {
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
        {
          elemID: workflowV2Instance.elemID,
          severity: 'Warning',
          message: 'Invalid workflow transition validator won’t be deployed',
          detailedMessage:
            "This workflow has a fieldHasSingleValue transition validator, which is missing 'fieldKey' field. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its 'fieldKey' field",
        },
      ])
    })
    it('should return an plural error if there are multiple invalid validators', async () => {
      workflowV2Instance.value.transitions.tran1.validators.push({
        parameters: {
          ruleType: 'fieldChanged',
        },
      })
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
        {
          elemID: workflowV2Instance.elemID,
          severity: 'Warning',
          message: 'Invalid workflow transition validator won’t be deployed',
          detailedMessage:
            "This workflow has the following transition validators fieldHasSingleValue, fieldChanged, which are missing 'fieldKey' field. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its 'fieldKey' field",
        },
      ])
    })
    it('should return a singular error if there are multiple invalid validators but only from one type', async () => {
      workflowV2Instance.value.transitions.tran1.validators.push({
        parameters: {
          ruleType: 'fieldHasSingleValue',
        },
      })
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([
        {
          elemID: workflowV2Instance.elemID,
          severity: 'Warning',
          message: 'Invalid workflow transition validator won’t be deployed',
          detailedMessage:
            "This workflow has a fieldHasSingleValue transition validator, which is missing 'fieldKey' field. The workflow will be deployed without this transition validator. To fix this, go to your Jira instance and delete the validator, or fix its 'fieldKey' field",
        },
      ])
    })
    it('should not return an error if workflow has only valid validator', async () => {
      workflowV2Instance.value.transitions.tran1.validators.pop()
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([])
    })
    it('should not return an error when there are no validators', async () => {
      delete workflowV2Instance.value.transitions.tran1.validators
      expect(await emptyValidatorWorkflowChangeValidator(changes)).toEqual([])
    })
    it('should not return an error when workflow is removed', async () => {
      expect(await emptyValidatorWorkflowChangeValidator([toChange({ before: workflowV2Instance })])).toEqual([])
    })
  })
})
