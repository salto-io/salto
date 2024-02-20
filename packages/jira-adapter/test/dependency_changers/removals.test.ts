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
import { removalsDependencyChanger } from '../../src/dependency_changers/removals'
import { JIRA } from '../../src/constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../src/filters/fields/constants'

describe('removalsDependencyChanger', () => {
  let type: ObjectType
  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID(JIRA, 'someType'),
    })
  })

  it('should add dependency from the added to removed project with the same key', async () => {
    const removedInstance = new InstanceElement('inst', type, {})

    const modifiedInstance = new InstanceElement('inst2', type, {
      ref: new ReferenceExpression(removedInstance.elemID, removedInstance),
    })

    const addedInstance = new InstanceElement('inst3', type, {})

    const inputChanges = new Map([
      [0, toChange({ before: removedInstance })],
      [1, toChange({ before: modifiedInstance, after: modifiedInstance })],
      [2, toChange({ after: addedInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await removalsDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)
  })

  it('should not add dependency if type is in ignored types', async () => {
    type = new ObjectType({
      elemID: new ElemID(JIRA, FIELD_CONTEXT_TYPE_NAME),
    })

    const removedInstance = new InstanceElement('inst', type, {})

    const modifiedInstance = new InstanceElement('inst2', type, {
      ref: new ReferenceExpression(removedInstance.elemID, removedInstance),
    })

    const addedInstance = new InstanceElement('inst3', type, {})

    const inputChanges = new Map([
      [0, toChange({ before: removedInstance })],
      [1, toChange({ before: modifiedInstance, after: modifiedInstance })],
      [2, toChange({ after: addedInstance })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await removalsDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
