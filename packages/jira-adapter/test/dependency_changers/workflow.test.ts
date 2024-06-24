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
import { ObjectType, InstanceElement, ElemID, toChange, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { workflowDependencyChanger } from '../../src/dependency_changers/workflow'
import { JIRA } from '../../src/constants'

describe('workflowDependencyChanger', () => {
  let workflowType: ObjectType
  let workflowSchemeType: ObjectType

  let workflowInstance: InstanceElement
  let workflowSchemeInstance1: InstanceElement
  let workflowSchemeInstance2: InstanceElement
  let workflowSchemeInstance3: InstanceElement

  beforeEach(() => {
    workflowType = new ObjectType({
      elemID: new ElemID(JIRA, 'Workflow'),
    })
    workflowSchemeType = new ObjectType({
      elemID: new ElemID(JIRA, 'WorkflowScheme'),
    })

    workflowInstance = new InstanceElement('inst', workflowType, {
      name: 'name',
    })

    workflowSchemeInstance1 = new InstanceElement('inst1', workflowSchemeType, {
      defaultWorkflow: new ReferenceExpression(workflowInstance.elemID, workflowInstance, workflowInstance),
    })

    workflowSchemeInstance2 = new InstanceElement('inst2', workflowSchemeType, {
      items: [
        {
          workflow: new ReferenceExpression(workflowInstance.elemID, workflowInstance, workflowInstance),
        },
      ],
    })

    workflowSchemeInstance3 = new InstanceElement('inst3', workflowSchemeType, {
      items: [{}],
    })
  })

  it('should add dependency from the workflow scheme to the referenced workflow', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: workflowInstance, after: workflowInstance })],
      [1, toChange({ before: workflowSchemeInstance1, after: workflowSchemeInstance1 })],
      [2, toChange({ before: workflowSchemeInstance2, after: workflowSchemeInstance2 })],
      [3, toChange({ before: workflowSchemeInstance3, after: workflowSchemeInstance3 })],
    ])

    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await workflowDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)

    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(1)
    expect(dependencyChanges[0].dependency.target).toEqual(0)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(2)
    expect(dependencyChanges[1].dependency.target).toEqual(0)
  })

  it('should ignore workflow string ids', async () => {
    workflowSchemeInstance1.value.defaultWorkflow = '5'
    workflowSchemeInstance2.value.items[0].workflow = '5'
    const inputChanges = new Map([
      [0, toChange({ before: workflowInstance, after: workflowInstance })],
      [1, toChange({ before: workflowSchemeInstance1, after: workflowSchemeInstance1 })],
      [2, toChange({ before: workflowSchemeInstance2, after: workflowSchemeInstance2 })],
      [3, toChange({ before: workflowSchemeInstance3, after: workflowSchemeInstance3 })],
    ])

    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await workflowDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
