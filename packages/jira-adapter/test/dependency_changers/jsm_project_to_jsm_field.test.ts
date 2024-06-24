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

import { InstanceElement, toChange, DependencyChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { createEmptyType } from '../utils'
import { PROJECT_TYPE } from '../../src/constants'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'
import { jsmProjectToJsmFieldDependencyChanger } from '../../src/dependency_changers/jsm_project_to_jsm_field'

describe('jsmProjectToJsmFieldDependencyChanger', () => {
  let dependencyChanges: DependencyChange[]
  let projectInstance: InstanceElement
  let fieldInstance: InstanceElement
  describe('jsmProjectToJsmFieldDependencyChanger with expected changes', () => {
    beforeEach(async () => {
      projectInstance = new InstanceElement('projectInstance', createEmptyType(PROJECT_TYPE), {
        id: '1',
        name: 'myServiceDesk',
        projectTypeKey: 'service_desk',
      })
      fieldInstance = new InstanceElement('fieldInstance', createEmptyType(FIELD_TYPE_NAME), {
        name: 'myField',
        id: 'myfield',
        type: 'com.atlassian.servicedesk:sd-sla-field',
      })
    })
    it('should add dependencies from jsm project to jsm field when they are both addition change', async () => {
      const inputChanges = new Map([
        [0, toChange({ after: projectInstance })],
        [1, toChange({ after: fieldInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await jsmProjectToJsmFieldDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(1)
      expect(dependencyChanges[0].action).toEqual('add')
      expect(dependencyChanges[0].dependency.source).toEqual(1)
      expect(dependencyChanges[0].dependency.target).toEqual(0)
    })
    it('should not add dependencies from jsm project to jsm field when project is modification change', async () => {
      const projectInstanceAfter = projectInstance.clone()
      projectInstanceAfter.value.name = 'myServiceDesk2'
      const inputChanges = new Map([
        [0, toChange({ before: projectInstance, after: projectInstanceAfter })],
        [1, toChange({ after: fieldInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await jsmProjectToJsmFieldDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not add dependencies from jsm project to jsm field when field is modification change', async () => {
      const fieldInstanceAfter = fieldInstance.clone()
      fieldInstanceAfter.value.name = 'myField2'
      const inputChanges = new Map([
        [0, toChange({ before: fieldInstance, after: fieldInstanceAfter })],
        [1, toChange({ after: projectInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await jsmProjectToJsmFieldDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not add dependencies from jsm project to not jsm field when they are both addition change', async () => {
      fieldInstance.value.type = 'notJsmField'
      const inputChanges = new Map([
        [0, toChange({ after: projectInstance })],
        [1, toChange({ after: fieldInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await jsmProjectToJsmFieldDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not add dependencies from not jsm project to jsm field when they are both addition change', async () => {
      projectInstance.value.projectTypeKey = 'software'
      const inputChanges = new Map([
        [0, toChange({ after: projectInstance })],
        [1, toChange({ after: fieldInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await jsmProjectToJsmFieldDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not add dependencies from not jsm project to not jsm field when they are both addition change', async () => {
      projectInstance.value.projectTypeKey = 'software'
      fieldInstance.value.type = 'notJsmField'
      const inputChanges = new Map([
        [0, toChange({ after: projectInstance })],
        [1, toChange({ after: fieldInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await jsmProjectToJsmFieldDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
  })
  describe('jsmProjectToJsmFieldDependencyChanger with unexpected changes', () => {
    beforeEach(async () => {
      projectInstance = new InstanceElement('projectInstance', createEmptyType(PROJECT_TYPE), {
        id: '1',
        name: 'myServiceDesk',
        projectTypeKey: 'service_desk',
      })
      fieldInstance = new InstanceElement('fieldInstance', createEmptyType(FIELD_TYPE_NAME), {
        name: 'myField',
        id: 'myfield',
        type: 'com.atlassian.servicedesk:sd-sla-field',
      })
    })
    it('should not add dependencies from project without projectTypeKey to jsm field when they are both addition change', async () => {
      delete projectInstance.value.projectTypeKey
      const inputChanges = new Map([
        [0, toChange({ after: projectInstance })],
        [1, toChange({ after: fieldInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await jsmProjectToJsmFieldDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
    it('should not add dependencies from jsm project to jsm field without type when they are both addition change', async () => {
      delete fieldInstance.value.type
      const inputChanges = new Map([
        [0, toChange({ after: projectInstance })],
        [1, toChange({ after: fieldInstance })],
      ])
      const inputDeps = new Map<collections.set.SetId, Set<collections.set.SetId>>([])
      dependencyChanges = [...(await jsmProjectToJsmFieldDependencyChanger(inputChanges, inputDeps))]
      expect(dependencyChanges).toHaveLength(0)
    })
  })
})
