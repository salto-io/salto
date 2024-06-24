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
import { InstanceElement, toChange, ReferenceExpression, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  ISSUE_LAYOUT_TYPE,
  ISSUE_TYPE_SCHEMA_NAME,
  ISSUE_TYPE_SCREEN_SCHEME_TYPE,
  PROJECT_TYPE,
} from '../../src/constants'
import { createEmptyType } from '../utils'
import { issueLayoutDependencyChanger } from '../../src/dependency_changers/issue_layout_dependency'

type SetId = collections.set.SetId

describe('issueLayoutDependencyChanger', () => {
  let issueTypeSchemeInstance1: InstanceElement
  let issueTypeSchemeInstance2: InstanceElement
  let issueTypeScreenSchemeInstance1: InstanceElement
  let issueTypeScreenSchemeInstance2: InstanceElement
  let screenSchemeInstance1: InstanceElement
  let screenSchemeInstance2: InstanceElement
  let projectInstance1: InstanceElement
  let projectInstance2: InstanceElement
  let issueLayoutInstance1: InstanceElement
  let issueLayoutInstance2: InstanceElement
  let inputDeps: Map<collections.set.SetId, Set<collections.set.SetId>>

  const issueTypeSchemeType = createEmptyType(ISSUE_TYPE_SCHEMA_NAME)
  const issueTypeScreenSchemeType = createEmptyType(ISSUE_TYPE_SCREEN_SCHEME_TYPE)
  const projectType = createEmptyType(PROJECT_TYPE)
  const issueLayoutType = createEmptyType(ISSUE_LAYOUT_TYPE)

  beforeEach(() => {
    issueTypeSchemeInstance1 = new InstanceElement('issueTypeScheme1', issueTypeSchemeType, {
      name: 'issueTypeScheme1',
      id: 10,
    })
    issueTypeSchemeInstance2 = new InstanceElement('issueTypeScheme2', issueTypeSchemeType, {
      name: 'issueTypeScheme2',
      id: 11,
    })
    screenSchemeInstance1 = new InstanceElement('screenScheme1', issueTypeScreenSchemeType, {
      name: 'screenScheme1',
      id: 40,
    })
    screenSchemeInstance2 = new InstanceElement('screenScheme2', issueTypeScreenSchemeType, {
      name: 'screenScheme2',
      id: 41,
    })

    issueTypeScreenSchemeInstance1 = new InstanceElement('issueTypeScreenScheme1', issueTypeScreenSchemeType, {
      name: 'issueTypeScreenScheme1',
      id: 20,
      issueTypeMappings: [
        {
          screenSchemeId: new ReferenceExpression(screenSchemeInstance1.elemID, screenSchemeInstance1),
        },
      ],
    })
    issueTypeScreenSchemeInstance2 = new InstanceElement('issueTypeScreenScheme2', issueTypeScreenSchemeType, {
      name: 'issueTypeScreenScheme2',
      id: 21,
      issueTypeMappings: [
        {
          screenSchemeId: new ReferenceExpression(screenSchemeInstance2.elemID, screenSchemeInstance2),
        },
      ],
    })
    projectInstance1 = new InstanceElement('projectInstance1', projectType, {
      issueTypeScheme: new ReferenceExpression(issueTypeSchemeInstance1.elemID, issueTypeSchemeInstance1),
      issueTypeScreenScheme: new ReferenceExpression(
        issueTypeScreenSchemeInstance1.elemID,
        issueTypeScreenSchemeInstance1,
      ),
    })
    projectInstance2 = new InstanceElement('projectInstance2', projectType, {
      issueTypeScheme: new ReferenceExpression(issueTypeSchemeInstance2.elemID, issueTypeSchemeInstance2),
      issueTypeScreenScheme: new ReferenceExpression(
        issueTypeScreenSchemeInstance2.elemID,
        issueTypeScreenSchemeInstance2,
      ),
    })
    issueLayoutInstance1 = new InstanceElement(
      'issueLayout1',
      issueLayoutType,
      {
        name: 'issueLayout1',
        id: 30,
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance1.elemID, projectInstance1)] },
    )
    issueLayoutInstance2 = new InstanceElement(
      'issueLayout2',
      issueLayoutType,
      {
        name: 'issueLayout2',
        id: 31,
      },
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(projectInstance2.elemID, projectInstance2)] },
    )

    inputDeps = new Map<SetId, Set<SetId>>([[0, new Set([1])]])
  })

  it('should create dependencies in the normal case', async () => {
    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(3)
    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance1' },
    })
  })
  it('should create dependencies if the project not in the changes', async () => {
    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(3)

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance1' },
    })
  })
  it('should create the correct dependencies if the issueTypeScreenScheme not in the changes', async () => {
    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance1' },
    })
  })
  it('should create the correct dependencies if the issueTypeScheme not in the changes', async () => {
    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance1' },
    })
  })
  it('should create the correct dependencies if the screenScheme not in the changes', async () => {
    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
    })
  })
  it('should create the correct dependencies if the issueTypeScreenScheme does not have issueTypeMappings', async () => {
    delete issueTypeScreenSchemeInstance1.value.issueTypeMappings

    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueTypeScreenSchemeInstance21', toChange({ after: issueTypeScreenSchemeInstance2 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
    })
  })
  it('should create the correct dependencies if the issueTypeMappings is empty', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = []
    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueTypeScreenSchemeInstance2', toChange({ after: issueTypeScreenSchemeInstance2 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(1)
    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
    })
  })
  it('should return the correct dependencies for 2 issueLayout in the same Project with 2 issueTypeMappings', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
      { screenSchemeId: new ReferenceExpression(screenSchemeInstance1.elemID, screenSchemeInstance1) },
      { screenSchemeId: new ReferenceExpression(screenSchemeInstance2.elemID, screenSchemeInstance2) },
    ]
    issueLayoutInstance2.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(projectInstance1.elemID, projectInstance1),
    ]
    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueLayoutInstance2', toChange({ after: issueLayoutInstance2 })],
      ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ['screenSchemeInstance2', toChange({ after: screenSchemeInstance2 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]

    expect(dependencyChanges).toHaveLength(8)
    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance2', target: 'issueTypeScreenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance2', target: 'issueTypeSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance2' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance2', target: 'screenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance2', target: 'screenSchemeInstance2' },
    })
  })
  it('should return the correct dependencies for 2 issueLayout from 2 Projects', async () => {
    const inputChanges = new Map([
      ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
      ['issueLayoutInstance2', toChange({ after: issueLayoutInstance2 })],
      ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
      ['issueTypeScreenSchemeInstance2', toChange({ after: issueTypeScreenSchemeInstance2 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['issueTypeSchemeInstance2', toChange({ after: issueTypeSchemeInstance2 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ['screenSchemeInstance2', toChange({ after: screenSchemeInstance2 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
      ['projectInstance2', toChange({ after: projectInstance2 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]

    expect(dependencyChanges).toHaveLength(6)
    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance2', target: 'issueTypeScreenSchemeInstance2' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance2', target: 'issueTypeSchemeInstance2' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance1' },
    })

    expect(dependencyChanges).toContainEqual({
      action: 'add',
      dependency: { source: 'issueLayoutInstance2', target: 'screenSchemeInstance2' },
    })
  })
  it('should not create dependencies if the issueLayout not in the changes', async () => {
    const inputChanges = new Map([
      ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
      ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
      ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ['projectInstance1', toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
  describe('Missing fields', () => {
    it('should create dependencies if the project in changes and missing issueTypeScreenScheme', async () => {
      delete projectInstance1.value.issueTypeScreenScheme
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
      })
    })
    it('should create dependencies if the project not in changes and missing issueTypeScreenScheme', async () => {
      delete projectInstance1.value.issueTypeScreenScheme
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
      })
    })
    it('should create dependencies if the project in changes and missing issueTypeScheme', async () => {
      delete projectInstance1.value.issueTypeScheme
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(2)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
      })

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance1' },
      })
    })
    it('should create dependencies if the project not in changes and missing issueTypeScheme', async () => {
      delete projectInstance1.value.issueTypeScheme
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(2)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
      })

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'screenSchemeInstance1' },
      })
    })
    it('should create dependencies if the issueTypeScreenScheme in changes and missing issueTypeMappings', async () => {
      delete issueTypeScreenSchemeInstance1.value.issueTypeMappings
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(2)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
      })

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
      })
    })
    it('should create dependencies if the issueTypeScreenScheme not in changes and missing issueTypeMappings', async () => {
      delete issueTypeScreenSchemeInstance1.value.issueTypeMappings
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
      })
    })
    it('should create dependencies if the issueTypeScreenScheme in changes and issueTypeMappings is empty', async () => {
      issueTypeScreenSchemeInstance1.value.issueTypeMappings = []
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(2)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
      })

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
      })
    })
    it('should create dependencies if the issueTypeScreenScheme not in changes and issueTypeMappings is empty', async () => {
      issueTypeScreenSchemeInstance1.value.issueTypeMappings = []
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
      })
    })

    it('should not create dependencies if the issueLayout has no parent', async () => {
      delete issueLayoutInstance1.annotations[CORE_ANNOTATIONS.PARENT][0]
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not create dependencies if the issueLayout has no CORE_ANNOTATIONS.PARENT', async () => {
      delete issueLayoutInstance1.annotations[CORE_ANNOTATIONS.PARENT]
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should create dependencies if the project issueTypeScreenScheme is defined but not a reference', async () => {
      projectInstance1.value.issueTypeScreenScheme = 'issueTypeScreenSchemeInstance1'
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
      })
    })
    it('should create dependencies if screenSchemeId is undefined', async () => {
      issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
        {
          screenSchemeId: undefined,
        },
      ]
      const inputChanges = new Map([
        ['issueLayoutInstance1', toChange({ after: issueLayoutInstance1 })],
        ['issueTypeScreenSchemeInstance1', toChange({ after: issueTypeScreenSchemeInstance1 })],
        ['issueTypeSchemeInstance1', toChange({ after: issueTypeSchemeInstance1 })],
        ['screenSchemeInstance1', toChange({ after: screenSchemeInstance1 })],
        ['projectInstance1', toChange({ after: projectInstance1 })],
      ])

      const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(2)

      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeScreenSchemeInstance1' },
      })
      expect(dependencyChanges).toContainEqual({
        action: 'add',
        dependency: { source: 'issueLayoutInstance1', target: 'issueTypeSchemeInstance1' },
      })
    })
  })
})
