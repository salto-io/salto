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
import { InstanceElement, toChange } from '@salto-io/adapter-api'
import { createEmptyType } from '../../utils'
import { workflowTransitionDuplicateNameValidator } from '../../../src/change_validators/workflows/workflow_transition_duplicate_names'

describe('workflowTransitionDuplicateNameValidator', () => {
  const workflowType = createEmptyType('Workflow')
  let instance: InstanceElement
  beforeEach(() => {
    instance = new InstanceElement(
      'instance',
      workflowType,
      {
        name: 'myName',
        transitions: {
          'transition1__From__none__Initial@fffsff': { name: 'transition1' },
          'transition2__From__open__Directed@fffsff': { name: 'transition2' },
          'transition3__From__any_status__Global@fffssff': { name: 'transition3' },
        },
      }
    )
  })
  it('should not return errors for workflows with unique transition keys', async () => {
    const result = await workflowTransitionDuplicateNameValidator([toChange({ after: instance })])
    expect(result).toHaveLength(0)
  })
  it('should return correct errors for workflows with duplicate transition keys', async () => {
    instance.value.transitions['transition4__From__open__Directed__1@fffsffff'] = { name: 'transition4' }
    instance.value.transitions['transition4__From__open__Directed__2@fffsffff'] = { name: 'transition4' }
    instance.value.transitions['transition5__From__open__Directed__3@fffsffff'] = { name: 'transition5' }
    instance.value.transitions['transition5__From__open__Directed__4@fffsffff'] = { name: 'transition5' }
    const instance2 = new InstanceElement(
      'instance2',
      workflowType,
      {
        name: 'myName2',
        transitions: {
          'transition1__From__none__Initial@fffsff': { name: 'transition1' },
          'transition2__From__open__Directed__1@fffsff': { name: 'transition2' },
          'transition2__From__open__Directed__2@fffsff': { name: 'transition2' },
        },
      }
    )

    const result = await workflowTransitionDuplicateNameValidator(
      [toChange({ after: instance }), toChange({ before: instance, after: instance2 })]
    )
    expect(result).toHaveLength(2)
    expect(result[0].elemID).toEqual(instance.elemID)
    expect(result[0].severity).toEqual('Error')
    expect(result[0].message).toEqual('Workflow transitions must be unique')
    expect(result[0].detailedMessage).toEqual(
      'A workflow with the name "myName" has transitions that cannot be distinguished by name, type and origin, and cannot be deployed.\n'
      + 'The transitions names are transition4, transition5.\n'
      + 'Change the name of the transitions to be unique.'
    )
    expect(result[1].elemID).toEqual(instance2.elemID)
    expect(result[1].severity).toEqual('Error')
    expect(result[1].message).toEqual('Workflow transitions must be unique')
    expect(result[1].detailedMessage).toEqual(
      'A workflow with the name "myName2" has transitions that cannot be distinguished by name, type and origin, and cannot be deployed.\n'
      + 'The transitions names are transition2.\n'
      + 'Change the name of the transitions to be unique.'
    )
  })
})
