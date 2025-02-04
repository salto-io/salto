/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { formsDependencyChanger } from '../../src/dependency_changers/forms'
import { FORM_TYPE, JIRA, PROJECT_TYPE } from '../../src/constants'
import { createEmptyType } from '../utils'

describe('formDependencyChanger', () => {
  let formType: ObjectType
  let formInstance1: InstanceElement
  let formInstance2: InstanceElement
  let formInstance3: InstanceElement

  let projectType: ObjectType
  let projectInstance1: InstanceElement

  beforeEach(() => {
    projectType = createEmptyType(PROJECT_TYPE)
    projectInstance1 = new InstanceElement('project_1', projectType)

    formType = new ObjectType({
      elemID: new ElemID(JIRA, FORM_TYPE),
    })
    formInstance1 = new InstanceElement('inst', formType, { id: '1' }, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance1.elemID, projectInstance1)],
    })
    formInstance2 = new InstanceElement('inst', formType, { id: '2' }, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance1.elemID, projectInstance1)],
    })
    formInstance3 = new InstanceElement('inst', formType, { id: '3' }, undefined, {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance1.elemID, projectInstance1)],
    })
  })

  it('should add dependency between addition and modification form changes', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: formInstance1 })],
      [1, toChange({ before: formInstance2, after: formInstance2 })],
      [2, toChange({ after: formInstance3 })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await formsDependencyChanger(inputChanges, inputDeps))]

    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)
    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(1)
    expect(dependencyChanges[1].dependency.target).toEqual(2)
  })

  it('should not add dependency to deletion form changes', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: formInstance1 })],
      [1, toChange({ before: formInstance2 })],
      [2, toChange({ after: formInstance3 })],
    ])
    const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

    const dependencyChanges = [...(await formsDependencyChanger(inputChanges, inputDeps))]

    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges[0].action).toEqual('add')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(2)
  })

  describe('forms from several projects', () => {
    let formInstance4DifferentProject: InstanceElement
    let formInstance5DifferentProject: InstanceElement

    beforeEach(() => {
      const projectInstance2 = new InstanceElement('project_2', projectType)

      formInstance4DifferentProject = new InstanceElement('inst', formType, { id: '4' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance2.elemID, projectInstance2)],
      })
      formInstance5DifferentProject = new InstanceElement('inst', formType, { id: '5' }, undefined, {
        [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance2.elemID, projectInstance2)],
      })
    })

    it('should add dependencies between forms in the same project', async () => {
      const inputChanges = new Map([
        [0, toChange({ after: formInstance1 })],
        [1, toChange({ before: formInstance2, after: formInstance2 })],
        [2, toChange({ after: formInstance4DifferentProject })],
        [3, toChange({ before: formInstance5DifferentProject, after: formInstance5DifferentProject })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])

      const dependencyChanges = [...(await formsDependencyChanger(inputChanges, inputDeps))]

      expect(dependencyChanges).toHaveLength(2)
      expect(dependencyChanges[0].action).toEqual('add')
      expect(dependencyChanges[0].dependency.source).toEqual(0)
      expect(dependencyChanges[0].dependency.target).toEqual(1)
      expect(dependencyChanges[1].action).toEqual('add')
      expect(dependencyChanges[1].dependency.source).toEqual(2)
      expect(dependencyChanges[1].dependency.target).toEqual(3)
    })
  })
})
