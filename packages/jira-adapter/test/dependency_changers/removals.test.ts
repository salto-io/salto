/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import each from 'jest-each'
import { ObjectType, InstanceElement, ElemID, toChange, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { removalsDependencyChanger } from '../../src/dependency_changers/removals'
import { JIRA, OBJECT_TYPE_TYPE } from '../../src/constants'
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
  each([FIELD_CONTEXT_TYPE_NAME, OBJECT_TYPE_TYPE]).it(
    'should not add dependency if type %s is in ignored types',
    async typeName => {
      type = new ObjectType({
        elemID: new ElemID(JIRA, typeName),
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
    },
  )
})
