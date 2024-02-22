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
import { ObjectType, InstanceElement, ElemID, toChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { projectDependencyChanger } from '../../src/dependency_changers/project'
import { JIRA } from '../../src/constants'

describe('projectDependencyChanger', () => {
  let type: ObjectType
  let instance: InstanceElement
  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
    })
    instance = new InstanceElement('inst', type, {
      key: 'key',
    })
  })

  it('should add dependency from the added to removed project with the same key', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: instance })],
      [1, toChange({ after: instance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await projectDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(1)
    expect(dependencyChanges[0].dependency.target).toEqual(0)
  })

  it('should add no dependencies if there is no key', async () => {
    delete instance.value.key
    const inputChanges = new Map([
      [0, toChange({ before: instance })],
      [1, toChange({ after: instance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await projectDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
