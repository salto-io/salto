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
import { toChange, InstanceElement } from '@salto-io/adapter-api'
import { readOnlyWorkflowValidator } from '../../../src/change_validators/workflows/read_only_workflow'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { createEmptyType } from '../../utils'

describe('workflowValidator', () => {
  let instance: InstanceElement
  describe('workflowV1', () => {
    beforeEach(() => {
      instance = new InstanceElement('instance', createEmptyType(WORKFLOW_TYPE_NAME), {
        operations: {},
      })
    })
    it('should return an error if can edit is false', async () => {
      instance.value.operations.canEdit = false
      expect(
        await readOnlyWorkflowValidator([
          toChange({
            before: instance,
            after: instance,
          }),
        ]),
      ).toEqual([
        {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot remove or modify system workflows',
          detailedMessage: 'Cannot remove or modify this system workflow, as it is a read-only one.',
        },
      ])
    })

    it('should not return an error if canEdit is true', async () => {
      instance.value.operations.canEdit = true
      expect(
        await readOnlyWorkflowValidator([
          toChange({
            before: instance,
            after: instance,
          }),
        ]),
      ).toEqual([])
    })
  })
  describe('workflowV2', () => {
    beforeEach(() => {
      instance = new InstanceElement('instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
        isEditable: false,
      })
    })
    it('should return an error if isEditable is false', async () => {
      expect(
        await readOnlyWorkflowValidator([
          toChange({
            before: instance,
            after: instance,
          }),
        ]),
      ).toEqual([
        {
          elemID: instance.elemID,
          severity: 'Error',
          message: 'Cannot remove or modify system workflows',
          detailedMessage: 'Cannot remove or modify this system workflow, as it is a read-only one.',
        },
      ])
    })

    it('should not return an error if isEditable is true', async () => {
      instance.value.isEditable = true
      expect(
        await readOnlyWorkflowValidator([
          toChange({
            before: instance,
            after: instance,
          }),
        ]),
      ).toEqual([])
    })
  })
})
