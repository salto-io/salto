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

  beforeEach(() => {
    const issueTypeSchemeType = createEmptyType(ISSUE_TYPE_SCHEMA_NAME)
    const issueTypeScreenSchemeType = createEmptyType(ISSUE_TYPE_SCREEN_SCHEME_TYPE)
    const projectType = createEmptyType(PROJECT_TYPE)
    const issueLayoutType = createEmptyType(ISSUE_LAYOUT_TYPE)

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

    inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([[0, new Set([1])]])
  })

  it('should create dependency in the normal case', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueTypeScreenSchemeInstance1 })],
      [2, toChange({ after: issueTypeSchemeInstance1 })],
      [3, toChange({ after: screenSchemeInstance1 })],
      [4, toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(6)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(1)
    expect(dependencyChanges[1].dependency.target).toEqual(0)

    expect(dependencyChanges[2].action).toEqual('remove')
    expect(dependencyChanges[2].dependency.source).toEqual(0)
    expect(dependencyChanges[2].dependency.target).toEqual(2)

    expect(dependencyChanges[3].action).toEqual('add')
    expect(dependencyChanges[3].dependency.source).toEqual(2)
    expect(dependencyChanges[3].dependency.target).toEqual(0)

    expect(dependencyChanges[4].action).toEqual('remove')
    expect(dependencyChanges[4].dependency.source).toEqual(0)
    expect(dependencyChanges[4].dependency.target).toEqual(3)

    expect(dependencyChanges[5].action).toEqual('add')
    expect(dependencyChanges[5].dependency.source).toEqual(3)
    expect(dependencyChanges[5].dependency.target).toEqual(0)
  })
  it('should create dependency if the project not in the changes', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueTypeScreenSchemeInstance1 })],
      [2, toChange({ after: issueTypeSchemeInstance1 })],
      [3, toChange({ after: screenSchemeInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(6)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(1)
    expect(dependencyChanges[1].dependency.target).toEqual(0)

    expect(dependencyChanges[2].action).toEqual('remove')
    expect(dependencyChanges[2].dependency.source).toEqual(0)
    expect(dependencyChanges[2].dependency.target).toEqual(2)

    expect(dependencyChanges[3].action).toEqual('add')
    expect(dependencyChanges[3].dependency.source).toEqual(2)
    expect(dependencyChanges[3].dependency.target).toEqual(0)

    expect(dependencyChanges[4].action).toEqual('remove')
    expect(dependencyChanges[4].dependency.source).toEqual(0)
    expect(dependencyChanges[4].dependency.target).toEqual(3)

    expect(dependencyChanges[5].action).toEqual('add')
    expect(dependencyChanges[5].dependency.source).toEqual(3)
    expect(dependencyChanges[5].dependency.target).toEqual(0)
  })
  it('should create the correct dependency if the issueTypeScreenScheme not in the changes', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueTypeSchemeInstance1 })],
      [2, toChange({ after: screenSchemeInstance1 })],
      [4, toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(4)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(1)
    expect(dependencyChanges[1].dependency.target).toEqual(0)

    expect(dependencyChanges[2].action).toEqual('remove')
    expect(dependencyChanges[2].dependency.source).toEqual(0)
    expect(dependencyChanges[2].dependency.target).toEqual(2)

    expect(dependencyChanges[3].action).toEqual('add')
    expect(dependencyChanges[3].dependency.source).toEqual(2)
    expect(dependencyChanges[3].dependency.target).toEqual(0)
  })
  it('should not create dependency if the issueTypeScheme not in the changes', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueTypeScreenSchemeInstance1 })],
      [2, toChange({ after: screenSchemeInstance1 })],
      [4, toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(4)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(1)
    expect(dependencyChanges[1].dependency.target).toEqual(0)

    expect(dependencyChanges[2].action).toEqual('remove')
    expect(dependencyChanges[2].dependency.source).toEqual(0)
    expect(dependencyChanges[2].dependency.target).toEqual(2)

    expect(dependencyChanges[3].action).toEqual('add')
    expect(dependencyChanges[3].dependency.source).toEqual(2)
    expect(dependencyChanges[3].dependency.target).toEqual(0)
  })
  it('should create the correct dependency if the screenScheme not in the changes', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueTypeScreenSchemeInstance1 })],
      [2, toChange({ after: issueTypeSchemeInstance1 })],
      [4, toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(4)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(1)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(1)
    expect(dependencyChanges[1].dependency.target).toEqual(0)

    expect(dependencyChanges[2].action).toEqual('remove')
    expect(dependencyChanges[2].dependency.source).toEqual(0)
    expect(dependencyChanges[2].dependency.target).toEqual(2)

    expect(dependencyChanges[3].action).toEqual('add')
    expect(dependencyChanges[3].dependency.source).toEqual(2)
    expect(dependencyChanges[3].dependency.target).toEqual(0)
  })
  it('should create the correct dependency if the issueTypeScreenScheme does not have issueTypeMappings', async () => {
    delete issueTypeScreenSchemeInstance1.value.issueTypeMappings

    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueTypeScreenSchemeInstance2 })],
      [2, toChange({ after: issueTypeSchemeInstance1 })],
      [3, toChange({ after: screenSchemeInstance1 })],
      [4, toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(2)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(2)
    expect(dependencyChanges[1].dependency.target).toEqual(0)
  })
  it('should create the correct dependency if the issueTypeMappings is empty', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = []
    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueTypeScreenSchemeInstance2 })],
      [2, toChange({ after: issueTypeSchemeInstance1 })],
      [3, toChange({ after: screenSchemeInstance1 })],
      [4, toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(2)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(2)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(2)
    expect(dependencyChanges[1].dependency.target).toEqual(0)
  })
  it('should return the correct dependency for 2 issueLayout in the same Project', async () => {
    issueTypeScreenSchemeInstance1.value.issueTypeMappings = [
      { screenSchemeId: new ReferenceExpression(screenSchemeInstance1.elemID, screenSchemeInstance1) },
      { screenSchemeId: new ReferenceExpression(screenSchemeInstance2.elemID, screenSchemeInstance2) },
    ]
    issueLayoutInstance2.annotations[CORE_ANNOTATIONS.PARENT] = [
      new ReferenceExpression(projectInstance1.elemID, projectInstance1),
    ]
    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueLayoutInstance2 })],
      [2, toChange({ after: issueTypeScreenSchemeInstance1 })],
      [3, toChange({ after: issueTypeSchemeInstance1 })],
      [4, toChange({ after: screenSchemeInstance1 })],
      [5, toChange({ after: screenSchemeInstance2 })],
      [6, toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]

    expect(dependencyChanges).toHaveLength(16)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(2)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(2)
    expect(dependencyChanges[1].dependency.target).toEqual(0)

    expect(dependencyChanges[2].action).toEqual('remove')
    expect(dependencyChanges[2].dependency.source).toEqual(0)
    expect(dependencyChanges[2].dependency.target).toEqual(3)

    expect(dependencyChanges[3].action).toEqual('add')
    expect(dependencyChanges[3].dependency.source).toEqual(3)
    expect(dependencyChanges[3].dependency.target).toEqual(0)

    expect(dependencyChanges[4].action).toEqual('remove')
    expect(dependencyChanges[4].dependency.source).toEqual(1)
    expect(dependencyChanges[4].dependency.target).toEqual(2)

    expect(dependencyChanges[5].action).toEqual('add')
    expect(dependencyChanges[5].dependency.source).toEqual(2)
    expect(dependencyChanges[5].dependency.target).toEqual(1)

    expect(dependencyChanges[6].action).toEqual('remove')
    expect(dependencyChanges[6].dependency.source).toEqual(1)
    expect(dependencyChanges[6].dependency.target).toEqual(3)

    expect(dependencyChanges[7].action).toEqual('add')
    expect(dependencyChanges[7].dependency.source).toEqual(3)
    expect(dependencyChanges[7].dependency.target).toEqual(1)

    expect(dependencyChanges[8].action).toEqual('remove')
    expect(dependencyChanges[8].dependency.source).toEqual(0)
    expect(dependencyChanges[8].dependency.target).toEqual(4)

    expect(dependencyChanges[9].action).toEqual('add')
    expect(dependencyChanges[9].dependency.source).toEqual(4)
    expect(dependencyChanges[9].dependency.target).toEqual(0)

    expect(dependencyChanges[10].action).toEqual('remove')
    expect(dependencyChanges[10].dependency.source).toEqual(0)
    expect(dependencyChanges[10].dependency.target).toEqual(5)

    expect(dependencyChanges[11].action).toEqual('add')
    expect(dependencyChanges[11].dependency.source).toEqual(5)
    expect(dependencyChanges[11].dependency.target).toEqual(0)

    expect(dependencyChanges[12].action).toEqual('remove')
    expect(dependencyChanges[12].dependency.source).toEqual(1)
    expect(dependencyChanges[12].dependency.target).toEqual(4)

    expect(dependencyChanges[13].action).toEqual('add')
    expect(dependencyChanges[13].dependency.source).toEqual(4)
    expect(dependencyChanges[13].dependency.target).toEqual(1)

    expect(dependencyChanges[14].action).toEqual('remove')
    expect(dependencyChanges[14].dependency.source).toEqual(1)
    expect(dependencyChanges[14].dependency.target).toEqual(5)

    expect(dependencyChanges[15].action).toEqual('add')
    expect(dependencyChanges[15].dependency.source).toEqual(5)
    expect(dependencyChanges[15].dependency.target).toEqual(1)
  })
  it('should return the correct dependency for 2 issueLayout from 2 Projects', async () => {
    const inputChanges = new Map([
      [0, toChange({ after: issueLayoutInstance1 })],
      [1, toChange({ after: issueLayoutInstance2 })],
      [2, toChange({ after: issueTypeScreenSchemeInstance1 })],
      [3, toChange({ after: issueTypeScreenSchemeInstance2 })],
      [4, toChange({ after: issueTypeSchemeInstance1 })],
      [5, toChange({ after: issueTypeSchemeInstance2 })],
      [6, toChange({ after: screenSchemeInstance1 })],
      [7, toChange({ after: screenSchemeInstance2 })],
      [8, toChange({ after: projectInstance1 })],
      [9, toChange({ after: projectInstance2 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]

    expect(dependencyChanges).toHaveLength(12)
    expect(dependencyChanges[0].action).toEqual('remove')
    expect(dependencyChanges[0].dependency.source).toEqual(0)
    expect(dependencyChanges[0].dependency.target).toEqual(2)

    expect(dependencyChanges[1].action).toEqual('add')
    expect(dependencyChanges[1].dependency.source).toEqual(2)
    expect(dependencyChanges[1].dependency.target).toEqual(0)

    expect(dependencyChanges[2].action).toEqual('remove')
    expect(dependencyChanges[2].dependency.source).toEqual(0)
    expect(dependencyChanges[2].dependency.target).toEqual(4)

    expect(dependencyChanges[3].action).toEqual('add')
    expect(dependencyChanges[3].dependency.source).toEqual(4)
    expect(dependencyChanges[3].dependency.target).toEqual(0)

    expect(dependencyChanges[4].action).toEqual('remove')
    expect(dependencyChanges[4].dependency.source).toEqual(1)
    expect(dependencyChanges[4].dependency.target).toEqual(3)

    expect(dependencyChanges[5].action).toEqual('add')
    expect(dependencyChanges[5].dependency.source).toEqual(3)
    expect(dependencyChanges[5].dependency.target).toEqual(1)

    expect(dependencyChanges[6].action).toEqual('remove')
    expect(dependencyChanges[6].dependency.source).toEqual(1)
    expect(dependencyChanges[6].dependency.target).toEqual(5)

    expect(dependencyChanges[7].action).toEqual('add')
    expect(dependencyChanges[7].dependency.source).toEqual(5)
    expect(dependencyChanges[7].dependency.target).toEqual(1)

    expect(dependencyChanges[8].action).toEqual('remove')
    expect(dependencyChanges[8].dependency.source).toEqual(0)
    expect(dependencyChanges[8].dependency.target).toEqual(6)

    expect(dependencyChanges[9].action).toEqual('add')
    expect(dependencyChanges[9].dependency.source).toEqual(6)
    expect(dependencyChanges[9].dependency.target).toEqual(0)

    expect(dependencyChanges[10].action).toEqual('remove')
    expect(dependencyChanges[10].dependency.source).toEqual(1)
    expect(dependencyChanges[10].dependency.target).toEqual(7)

    expect(dependencyChanges[11].action).toEqual('add')
    expect(dependencyChanges[11].dependency.source).toEqual(7)
    expect(dependencyChanges[11].dependency.target).toEqual(1)
  })
  it('should not create dependency if the issueLayout not in the changes', async () => {
    const inputChanges = new Map([
      [1, toChange({ after: issueTypeScreenSchemeInstance1 })],
      [2, toChange({ after: issueTypeSchemeInstance1 })],
      [3, toChange({ after: screenSchemeInstance1 })],
      [4, toChange({ after: projectInstance1 })],
    ])

    const dependencyChanges = [...(await issueLayoutDependencyChanger(inputChanges, inputDeps))]
    expect(dependencyChanges).toHaveLength(0)
  })
})
