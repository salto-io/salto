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
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { CUSTOM_OBJECT_FIELD_TYPE_NAME, CUSTOM_OBJECT_TYPE_NAME, ZENDESK } from '../../src/constants'
import { customObjectAndFieldDependencyChanger } from '../../src/dependency_changers/custom_object_and_field_change'

describe('customObjectAndFieldChanger', () => {
  const customObject = new InstanceElement(
    'customObject',
    new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_TYPE_NAME) }),
  )
  const customObjectField = new InstanceElement(
    'customObjectField',
    new ObjectType({ elemID: new ElemID(ZENDESK, CUSTOM_OBJECT_FIELD_TYPE_NAME) }),
    {},
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(customObject.elemID)] },
  )

  it('should remove from field to the parent and add from parent to field', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: customObject })],
      [1, toChange({ before: customObjectField })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await customObjectAndFieldDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(2)
    expect(dependencyChanges[0].action).toBe('add')
    expect(dependencyChanges[1].action).toBe('remove')
    expect(dependencyChanges[0].dependency).toMatchObject({ source: 0, target: 1 })
    expect(dependencyChanges[1].dependency).toMatchObject({ source: 1, target: 0 })
  })
  it('should do nothing if the parent customObject is not removed', async () => {
    const inputChanges = new Map([
      [0, toChange({ before: customObject, after: customObject })],
      [1, toChange({ before: customObjectField })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([
      [0, new Set()],
      [1, new Set()],
    ])

    const dependencyChanges = [...(await customObjectAndFieldDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges.length).toBe(0)
  })
})
