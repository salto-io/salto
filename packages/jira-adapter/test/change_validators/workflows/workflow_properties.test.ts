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
import { toChange, InstanceElement, Change } from '@salto-io/adapter-api'
import { workflowPropertiesValidator } from '../../../src/change_validators/workflows/workflow_properties'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import { createEmptyType } from '../../utils'

const WORKFLOW_V1 = 'workflowV1'
const WORKFLOW_V2 = 'workflowV2'

describe('workflowPropertiesValidator', () => {
  let instance: InstanceElement
  let changes: Change<InstanceElement>[]
  const setupInstance = (workflowVersion: string): void => {
    if (workflowVersion === WORKFLOW_V1) {
      instance = new InstanceElement('instance', createEmptyType(WORKFLOW_TYPE_NAME), {
        transitions: {
          tran1: {
            name: 'tran1',
            properties: [
              {
                key: 'key',
                value: 'true',
              },
            ],
          },
        },
        statuses: [
          {
            properties: [
              {
                key: 'key',
                value: 'true',
              },
            ],
          },
        ],
      })
    } else if (workflowVersion === WORKFLOW_V2) {
      instance = new InstanceElement('workflowV2Instance', createEmptyType(WORKFLOW_CONFIGURATION_TYPE), {
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
        statuses: [
          {
            properties: [
              {
                key: 'key',
                value: 'true',
              },
            ],
          },
        ],
        transitions: {
          tran1: {
            name: 'tran1',
            id: 'id',
            type: 'DIRECTED',
            properties: [
              {
                key: 'key',
                value: 'true',
              },
            ],
          },
        },
      })
    }
  }

  describe.each([[WORKFLOW_V1], [WORKFLOW_V2]])('%s ', workflowVersion => {
    beforeEach(() => {
      setupInstance(workflowVersion)
      changes = [toChange({ after: instance })]
    })
    it('should return an error if there are transition properties with the same key', async () => {
      instance.value.transitions.tran1.properties.push({
        key: 'key',
        value: 'false',
      })
      expect(await workflowPropertiesValidator(changes)).toEqual([
        {
          elemID: instance.elemID,
          severity: 'Error',
          message:
            "Can't deploy workflow with status or transition that have multiple properties with an identical key.",
          detailedMessage: `Can't deploy workflow ${instance.elemID.getFullName()} which has status or transition with multiple properties with an identical key.`,
        },
      ])
    })
    it('should return an error if there are statuses properties with the same key', async () => {
      instance.value.statuses[0].properties.push({
        key: 'key',
        value: 'false',
      })
      expect(await workflowPropertiesValidator(changes)).toEqual([
        {
          elemID: instance.elemID,
          severity: 'Error',
          message:
            "Can't deploy workflow with status or transition that have multiple properties with an identical key.",
          detailedMessage: `Can't deploy workflow ${instance.elemID.getFullName()} which has status or transition with multiple properties with an identical key.`,
        },
      ])
    })
    it('should not return an error if the statuses are undefined', async () => {
      instance.value.statuses = undefined
      expect(await workflowPropertiesValidator(changes)).toEqual([])
    })
    it('should not return an error when there is no properties', async () => {
      instance.value.statuses[0].properties = undefined
      instance.value.transitions.tran1.properties = undefined
      expect(await workflowPropertiesValidator(changes)).toEqual([])
    })
    it('should not return an error when the properties are valid', async () => {
      expect(await workflowPropertiesValidator(changes)).toEqual([])
    })
  })
})
