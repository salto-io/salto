/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, InstanceElement, ElemID, toChange, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { JIRA, OBJECT_SCHEMA_TYPE, OBJECT_TYPE_TYPE } from '../../src/constants'
import { objectTypeParentDependencyChanger } from '../../src/dependency_changers/object_type_parent'

describe('objectTypeParentReversal', () => {
  let objectTypeInstance: InstanceElement
  let objectTypeInstance2: InstanceElement
  let noRefObjectTypeInstance: InstanceElement
  let schemaTypeInstance: InstanceElement
  let inputDeps: Map<collections.set.SetId, Set<collections.set.SetId>>
  beforeEach(() => {
    const objectTypeType = new ObjectType({
      elemID: new ElemID(JIRA, OBJECT_TYPE_TYPE),
    })

    const schemaType = new ObjectType({
      elemID: new ElemID(JIRA, OBJECT_SCHEMA_TYPE),
    })

    noRefObjectTypeInstance = new InstanceElement('instNoRef', objectTypeType, {})

    objectTypeInstance = new InstanceElement('inst', objectTypeType, {
      parentObjectTypeId: new ReferenceExpression(noRefObjectTypeInstance.elemID, noRefObjectTypeInstance),
    })

    objectTypeInstance2 = new InstanceElement('inst2', objectTypeType, {
      parentObjectTypeId: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
    })

    schemaTypeInstance = new InstanceElement('schemaInst', schemaType, {
      parentObjectTypeId: [new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance)],
    })
    inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>()
  })

  it('should reverse the dependency of objectType and its parent on removal', async () => {
    const inputChanges = new Map([
      [2, toChange({ before: objectTypeInstance2 })],
      [1, toChange({ before: objectTypeInstance })],
      [0, toChange({ before: noRefObjectTypeInstance })],
    ])

    const dependencyChanges = [...(await objectTypeParentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(4)
    expect(dependencyChanges).toContainEqual({ action: 'add', dependency: { source: 2, target: 1 } })
    expect(dependencyChanges).toContainEqual({ action: 'remove', dependency: { source: 1, target: 2 } })
    expect(dependencyChanges).toContainEqual({ action: 'add', dependency: { source: 1, target: 0 } })
    expect(dependencyChanges).toContainEqual({ action: 'remove', dependency: { source: 0, target: 1 } })
  })
  it('should work correctly when parent is not in the changes', async () => {
    const inputChanges = new Map([
      [2, toChange({ before: objectTypeInstance2 })],
      [1, toChange({ before: objectTypeInstance })],
    ])

    const dependencyChanges = [...(await objectTypeParentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges).toContainEqual({ action: 'add', dependency: { source: 2, target: 1 } })
    expect(dependencyChanges).toContainEqual({ action: 'remove', dependency: { source: 1, target: 2 } })
  })
  it('should return empty list when parent is not an object type', async () => {
    objectTypeInstance.value.parentObjectTypeId = new ReferenceExpression(schemaTypeInstance.elemID, schemaTypeInstance)
    const inputChanges = new Map([
      [2, toChange({ before: objectTypeInstance })],
      [1, toChange({ before: schemaTypeInstance })],
    ])
    const dependencyChanges = [...(await objectTypeParentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
  it('should return empty list when parent is not a reference', async () => {
    objectTypeInstance.value.parentObjectTypeId = 18
    const inputChanges = new Map([
      [2, toChange({ before: objectTypeInstance })],
      [1, toChange({ before: noRefObjectTypeInstance })],
    ])
    const dependencyChanges = [...(await objectTypeParentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
  it('should return empty list when there are no removals', async () => {
    const inputChanges = new Map([
      [2, toChange({ after: objectTypeInstance2 })],
      [1, toChange({ after: objectTypeInstance })],
    ])
    const dependencyChanges = [...(await objectTypeParentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
  it('should return empty list when there are no changes', async () => {
    const inputChanges = new Map()
    const dependencyChanges = [...(await objectTypeParentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
  it('should not create a dependency from an instance that is not object type', async () => {
    schemaTypeInstance.value.parentObjectTypeId = new ReferenceExpression(
      noRefObjectTypeInstance.elemID,
      noRefObjectTypeInstance,
    )
    const inputChanges = new Map([
      [1, toChange({ before: schemaTypeInstance })],
      [0, toChange({ before: noRefObjectTypeInstance })],
    ])
    const dependencyChanges = [...(await objectTypeParentDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
