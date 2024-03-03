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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { createEmptyType } from '../../utils'
import { workflowTransitionDuplicateNameValidator } from '../../../src/change_validators/workflows/workflow_transition_duplicate_names'
import { WORKFLOW_CONFIGURATION_TYPE, WORKFLOW_TYPE_NAME } from '../../../src/constants'

const WORKFLOW_V1 = 'workflowV1'
const WORKFLOW_V2 = 'workflowV2'

describe('workflowTransitionDuplicateNameValidator', () => {
  let instance: InstanceElement
  let afterInstance: InstanceElement
  const setupInstances = (workflowVersion: string): void => {
    if (workflowVersion === 'workflowV1') {
      const workflowV1Type = createEmptyType(WORKFLOW_TYPE_NAME)
      instance = new InstanceElement('instance', workflowV1Type, {
        name: 'myName',
        transitions: {
          'transition1__From__none__Initial@fffsff': { name: 'transition1' },
          'transition2__From__open__Directed@fffsff': { name: 'transition2' },
          'transition3__From__any_status__Global@fffssff': { name: 'transition3' },
        },
      })
      afterInstance = new InstanceElement('afterInstance', workflowV1Type, {
        name: 'myName2',
        transitions: {
          'transition1__From__none__Initial@fffsff': { name: 'transition1' },
          'transition2__From__open__Directed__1@fffsff': { name: 'transition2' },
          'transition2__From__open__Directed__2@fffsff': { name: 'transition2' },
        },
      })
    }
    if (workflowVersion === 'workflowV2') {
      const workflowV2Type = createEmptyType(WORKFLOW_CONFIGURATION_TYPE)
      instance = new InstanceElement('workflowV2Instance', workflowV2Type, {
        name: 'myName',
        version: {
          versionNumber: 1,
          id: '123',
        },
        scope: {
          project: 'project',
          type: 'type',
        },
        id: '123',
        statuses: [],
        transitions: {
          'transition1__From__none__Initial@fffsff': { name: 'transition1', type: 'Initial', id: '1' },
          'transition2__From__open__Directed@fffsff': { name: 'transition2', type: 'Directed', id: '2' },
          'transition3__From__any_status__Global@fffssff': { name: 'transition3', type: 'Global', id: '3' },
        },
      })
      afterInstance = new InstanceElement('afterInstance', workflowV2Type, {
        name: 'myName2',
        version: {
          versionNumber: 1,
          id: '123',
        },
        scope: {
          project: 'project',
          type: 'type',
        },
        id: '123',
        statuses: [],
        transitions: {
          'transition1__From__none__Initial@fffsff': { name: 'transition1', type: 'Initial', id: '1' },
          'transition2__From__open__Directed__1@fffsff': { name: 'transition2', type: 'Directed', id: '2' },
          'transition2__From__open__Directed__2@fffsff': { name: 'transition2', type: 'Directed', id: '3' },
        },
      })
    }
  }
  describe.each([[WORKFLOW_V1], [WORKFLOW_V2]])('%s ', workflowVersion => {
    beforeEach(() => {
      setupInstances(workflowVersion)
    })
    it('should not return errors for workflows with unique transition keys', async () => {
      const result = await workflowTransitionDuplicateNameValidator([toChange({ after: instance })])
      expect(result).toHaveLength(0)
    })
    it('should return correct errors for workflows with duplicate transition keys', async () => {
      instance.value.transitions['transition4__From__open__Directed__1@fffsffff'] = {
        name: 'transition4',
        type: 'Directed',
        id: '4',
      }
      instance.value.transitions['transition4__From__open__Directed__2@fffsffff'] = {
        name: 'transition4',
        type: 'Directed',
        id: '5',
      }
      instance.value.transitions['transition5__From__open__Directed__3@fffsffff'] = {
        name: 'transition5',
        type: 'Directed',
        id: '6',
      }
      instance.value.transitions['transition5__From__open__Directed__4@fffsffff'] = {
        name: 'transition5',
        type: 'Directed',
        id: '7',
      }

      const result = await workflowTransitionDuplicateNameValidator([
        toChange({ after: instance }),
        toChange({ before: instance, after: afterInstance }),
      ])
      expect(result).toHaveLength(2)
      expect(result[0].elemID).toEqual(instance.elemID)
      expect(result[0].severity).toEqual('Error')
      expect(result[0].message).toEqual('Workflow transitions must be unique')
      expect(result[0].detailedMessage).toEqual(
        'A workflow with the name "myName" has transitions that cannot be distinguished by name, type and origin, and cannot be deployed.\n' +
          'The transitions names are transition4, transition5.\n' +
          'Change the name of the transitions to be unique.',
      )
      expect(result[1].elemID).toEqual(afterInstance.elemID)
      expect(result[1].severity).toEqual('Error')
      expect(result[1].message).toEqual('Workflow transitions must be unique')
      expect(result[1].detailedMessage).toEqual(
        'A workflow with the name "myName2" has transitions that cannot be distinguished by name, type and origin, and cannot be deployed.\n' +
          'The transitions names are transition2.\n' +
          'Change the name of the transitions to be unique.',
      )
    })
  })
})
