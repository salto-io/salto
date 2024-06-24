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

import { ElemID, InstanceElement, ObjectType, toChange, ReferenceExpression } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { createEmptyType, getFilterParams } from '../../utils'
import scriptRunnerBrokenReferenceFilter from '../../../src/filters/broken_reference_filter'
import {
  BEHAVIOR_TYPE,
  ISSUE_TYPE_NAME,
  JIRA,
  PROJECT_TYPE,
  SCRIPTED_FIELD_TYPE,
  SCRIPT_FRAGMENT_TYPE,
  SCRIPT_RUNNER_LISTENER_TYPE,
} from '../../../src/constants'

describe('scriptRunnerBrokenReferenceFilter', () => {
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let scriptedFieldsType: ObjectType
  let projectType: ObjectType
  let IssueTypeType: ObjectType
  let listenerType: ObjectType
  let scriptedFieldInstance: InstanceElement
  let behaviorsInstance: InstanceElement
  let listenerInstance: InstanceElement
  let fragmentsInstance: InstanceElement
  let projectInstance: InstanceElement
  let unresolvedProject: ReferenceExpression
  let resolvedProject: ReferenceExpression
  let unresolvedIssueType: ReferenceExpression
  let resolvedIssueType: ReferenceExpression
  let issueTypeInstance: InstanceElement

  beforeEach(async () => {
    filter = scriptRunnerBrokenReferenceFilter(getFilterParams()) as filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
    scriptedFieldsType = createEmptyType(SCRIPTED_FIELD_TYPE)
    projectType = createEmptyType(PROJECT_TYPE)
    IssueTypeType = createEmptyType(ISSUE_TYPE_NAME)
    const behaviorType = createEmptyType(BEHAVIOR_TYPE)
    const fragmentsType = createEmptyType(SCRIPT_FRAGMENT_TYPE)
    listenerType = createEmptyType(SCRIPT_RUNNER_LISTENER_TYPE)
    projectInstance = new InstanceElement('ProjectInstance', projectType)
    issueTypeInstance = new InstanceElement('IssueTypeInstance', IssueTypeType, {
      id: 'issueType1',
      name: 'IssueTypeName1',
    })
    resolvedProject = new ReferenceExpression(projectInstance.elemID, projectInstance)
    unresolvedProject = new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'missing_1'), undefined)
    resolvedIssueType = new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance)
    unresolvedIssueType = new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'missing_2'), undefined)
    scriptedFieldInstance = new InstanceElement('ScriptedFieldInstance', scriptedFieldsType, {
      projectKeys: [resolvedProject, unresolvedProject],
      issueTypes: [resolvedIssueType, unresolvedIssueType],
    })
    behaviorsInstance = new InstanceElement('BehaviorsInstance', behaviorType, {
      projects: [resolvedProject, unresolvedProject],
      issueTypes: [resolvedIssueType, unresolvedIssueType],
    })
    listenerInstance = new InstanceElement('ListenerInstance', listenerType, {
      projects: [resolvedProject, unresolvedProject],
    })
    fragmentsInstance = new InstanceElement('FragmentsInstance', fragmentsType, {
      entities: [resolvedProject, unresolvedProject],
    })
  })

  describe('preDeploy', () => {
    it('should remove unresolved project from the scripted fields for adding and modification', async () => {
      const modificationInstance = scriptedFieldInstance.clone()
      const deletedInstance = scriptedFieldInstance.clone()
      await filter.preDeploy([
        toChange({ after: scriptedFieldInstance }),
        toChange({ before: scriptedFieldInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(scriptedFieldInstance.value.projectKeys).toHaveLength(1)
      expect(scriptedFieldInstance.value.issueTypes).toHaveLength(1)
      expect(modificationInstance.value.projectKeys).toHaveLength(1)
      expect(modificationInstance.value.issueTypes).toHaveLength(1)
      expect(deletedInstance.value.projectKeys).toHaveLength(2)
      expect(deletedInstance.value.issueTypes).toHaveLength(2)

      expect(scriptedFieldInstance.value.projectKeys[0]).toEqual(resolvedProject)
      expect(scriptedFieldInstance.value.issueTypes[0]).toEqual(resolvedIssueType)
      expect(modificationInstance.value.projectKeys[0]).toEqual(resolvedProject)
      expect(modificationInstance.value.issueTypes[0]).toEqual(resolvedIssueType)
      expect(deletedInstance.value.projectKeys).toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.issueTypes).toEqual([resolvedIssueType, unresolvedIssueType])
    })
    it('should remove unresolved project from behaviors for adding and modification', async () => {
      const modificationInstance = behaviorsInstance.clone()
      const deletedInstance = behaviorsInstance.clone()
      await filter.preDeploy([
        toChange({ after: behaviorsInstance }),
        toChange({ before: behaviorsInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(behaviorsInstance.value.projects).toHaveLength(1)
      expect(behaviorsInstance.value.issueTypes).toHaveLength(1)
      expect(modificationInstance.value.projects).toHaveLength(1)
      expect(modificationInstance.value.issueTypes).toHaveLength(1)
      expect(deletedInstance.value.projects).toHaveLength(2)
      expect(deletedInstance.value.issueTypes).toHaveLength(2)

      expect(behaviorsInstance.value.projects[0]).toEqual(resolvedProject)
      expect(behaviorsInstance.value.issueTypes[0]).toEqual(resolvedIssueType)
      expect(modificationInstance.value.projects[0]).toEqual(resolvedProject)
      expect(modificationInstance.value.issueTypes[0]).toEqual(resolvedIssueType)
      expect(deletedInstance.value.projects).toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.issueTypes).toEqual([resolvedIssueType, unresolvedIssueType])
    })
    it('should remove unresolved project from the listeners for adding and modification', async () => {
      const modificationInstance = listenerInstance.clone()
      const deletedInstance = listenerInstance.clone()
      await filter.preDeploy([
        toChange({ after: listenerInstance }),
        toChange({ before: listenerInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(listenerInstance.value.projects).toHaveLength(1)
      expect(modificationInstance.value.projects).toHaveLength(1)
      expect(deletedInstance.value.projects).toHaveLength(2)

      expect(listenerInstance.value.projects[0]).toEqual(resolvedProject)
      expect(modificationInstance.value.projects[0]).toEqual(resolvedProject)
      expect(deletedInstance.value.projects).toEqual([resolvedProject, unresolvedProject])
    })
    it('should remove unresolved project from fragments for adding and modification', async () => {
      const modificationInstance = fragmentsInstance.clone()
      const deletedInstance = fragmentsInstance.clone()
      await filter.preDeploy([
        toChange({ after: fragmentsInstance }),
        toChange({ before: fragmentsInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(fragmentsInstance.value.entities).toHaveLength(1)
      expect(modificationInstance.value.entities).toHaveLength(1)
      expect(deletedInstance.value.entities).toHaveLength(2)

      expect(fragmentsInstance.value.entities[0]).toEqual(resolvedProject)
      expect(modificationInstance.value.entities[0]).toEqual(resolvedProject)
      expect(deletedInstance.value.entities).toEqual([resolvedProject, unresolvedProject])
    })
  })
  describe('onDeploy', () => {
    it('should add back unresolved project references to the scripted fields when adding or modifying', async () => {
      const modificationInstance = scriptedFieldInstance.clone()
      const deletedInstance = scriptedFieldInstance.clone()

      await filter.preDeploy([
        toChange({ after: scriptedFieldInstance }),
        toChange({ before: scriptedFieldInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(scriptedFieldInstance.value.projectKeys).toHaveLength(1)
      expect(modificationInstance.value.projectKeys).toHaveLength(1)
      expect(deletedInstance.value.projectKeys).toHaveLength(2)
      await filter.onDeploy([
        toChange({ after: scriptedFieldInstance }),
        toChange({ before: scriptedFieldInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(scriptedFieldInstance.value.projectKeys).toHaveLength(2)
      expect(scriptedFieldInstance.value.issueTypes).toHaveLength(2)
      expect(modificationInstance.value.projectKeys).toHaveLength(2)
      expect(modificationInstance.value.issueTypes).toHaveLength(2)
      expect(deletedInstance.value.projectKeys).toHaveLength(2)
      expect(deletedInstance.value.issueTypes).toHaveLength(2)

      expect(scriptedFieldInstance.value.projectKeys).toEqual([resolvedProject, unresolvedProject])
      expect(scriptedFieldInstance.value.issueTypes).toEqual([resolvedIssueType, unresolvedIssueType])
      expect(modificationInstance.value.projectKeys).toEqual([resolvedProject, unresolvedProject])
      expect(modificationInstance.value.issueTypes).toEqual([resolvedIssueType, unresolvedIssueType])
      expect(deletedInstance.value.projectKeys).toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.issueTypes).toEqual([resolvedIssueType, unresolvedIssueType])
    })
    it('should add back unresolved project references to behaviors when adding or modifying', async () => {
      const modificationInstance = behaviorsInstance.clone()
      const deletedInstance = behaviorsInstance.clone()

      await filter.preDeploy([
        toChange({ after: behaviorsInstance }),
        toChange({ before: behaviorsInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(behaviorsInstance.value.projects).toHaveLength(1)
      expect(modificationInstance.value.projects).toHaveLength(1)
      expect(deletedInstance.value.projects).toHaveLength(2)
      await filter.onDeploy([
        toChange({ after: behaviorsInstance }),
        toChange({ before: behaviorsInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(behaviorsInstance.value.projects).toHaveLength(2)
      expect(behaviorsInstance.value.issueTypes).toHaveLength(2)
      expect(modificationInstance.value.projects).toHaveLength(2)
      expect(modificationInstance.value.issueTypes).toHaveLength(2)
      expect(deletedInstance.value.projects).toHaveLength(2)
      expect(deletedInstance.value.issueTypes).toHaveLength(2)

      expect(behaviorsInstance.value.projects).toEqual([resolvedProject, unresolvedProject])
      expect(behaviorsInstance.value.issueTypes).toEqual([resolvedIssueType, unresolvedIssueType])
      expect(modificationInstance.value.projects).toEqual([resolvedProject, unresolvedProject])
      expect(modificationInstance.value.issueTypes).toEqual([resolvedIssueType, unresolvedIssueType])
      expect(deletedInstance.value.projects).toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.issueTypes).toEqual([resolvedIssueType, unresolvedIssueType])
    })
    it('should add back unresolved project references to listeners when adding or modifying', async () => {
      const modificationInstance = listenerInstance.clone()
      const deletedInstance = listenerInstance.clone()

      await filter.preDeploy([
        toChange({ after: listenerInstance }),
        toChange({ before: listenerInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(listenerInstance.value.projects).toHaveLength(1)
      expect(modificationInstance.value.projects).toHaveLength(1)
      expect(deletedInstance.value.projects).toHaveLength(2)
      await filter.onDeploy([
        toChange({ after: listenerInstance }),
        toChange({ before: listenerInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(listenerInstance.value.projects).toHaveLength(2)
      expect(modificationInstance.value.projects).toHaveLength(2)
      expect(deletedInstance.value.projects).toHaveLength(2)

      expect(listenerInstance.value.projects).toEqual([resolvedProject, unresolvedProject])
      expect(modificationInstance.value.projects).toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.projects).toEqual([resolvedProject, unresolvedProject])
    })
    it('should add back unresolved project references to fragments when adding or modifying', async () => {
      const modificationInstance = fragmentsInstance.clone()
      const deletedInstance = fragmentsInstance.clone()

      await filter.preDeploy([
        toChange({ after: fragmentsInstance }),
        toChange({ before: fragmentsInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(fragmentsInstance.value.entities).toHaveLength(1)
      expect(modificationInstance.value.entities).toHaveLength(1)
      expect(deletedInstance.value.entities).toHaveLength(2)
      await filter.onDeploy([
        toChange({ after: fragmentsInstance }),
        toChange({ before: fragmentsInstance, after: modificationInstance }),
        toChange({ before: deletedInstance }),
      ])

      expect(fragmentsInstance.value.entities).toHaveLength(2)
      expect(modificationInstance.value.entities).toHaveLength(2)
      expect(deletedInstance.value.entities).toHaveLength(2)

      expect(fragmentsInstance.value.entities).toEqual([resolvedProject, unresolvedProject])
      expect(modificationInstance.value.entities).toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.entities).toEqual([resolvedProject, unresolvedProject])
    })
    it('should not crash if onDeployCalled without predeploy', async () => {
      await filter.onDeploy([toChange({ after: scriptedFieldInstance })])
      expect(scriptedFieldInstance.value.projectKeys).toHaveLength(2)
      expect(scriptedFieldInstance.value.issueTypes).toHaveLength(2)
    })
  })
})
