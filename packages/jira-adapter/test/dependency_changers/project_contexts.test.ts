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
import { projectContextsDependencyChanger } from '../../src/dependency_changers/project_contexts'
import { JIRA, PROJECT_TYPE } from '../../src/constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../src/filters/fields/constants'
import { PROJECT_CONTEXTS_FIELD } from '../../src/filters/fields/contexts_projects_filter'

describe('projectContextsDependencyChanger', () => {
  let contextType: ObjectType
  let projectType: ObjectType
  let contextInstance: InstanceElement
  let projectInstance: InstanceElement

  beforeEach(() => {
    contextType = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
    })

    contextInstance = new InstanceElement('inst', contextType)

    projectInstance = new InstanceElement('inst', projectType, {
      [PROJECT_CONTEXTS_FIELD]: [new ReferenceExpression(contextInstance.elemID, contextInstance)],
    })
  })

  it('should reverse the dependency between the project and the context', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: projectInstance })],
      [1, toChange({ after: contextInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([[0, new Set([1])]])

    const dependencyChanges = [...(await projectContextsDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(1)
    expect(dependencyChanges[1].dependency.target).toEqual(0)
  })

  it('should do nothing when there is no context change', async () => {
    const inputChanges = new Map([[0, toChange({ after: projectInstance })]])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([[0, new Set([1])]])

    const dependencyChanges = [...(await projectContextsDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })

  it('should do nothing when there are no dependencies', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: projectInstance })],
      [1, toChange({ after: contextInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await projectContextsDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
