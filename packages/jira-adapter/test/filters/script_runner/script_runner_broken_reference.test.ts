/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ISSUE_TYPE_NAME, JIRA, PROJECT_TYPE, SCRIPTED_FIELD_TYPE } from '../../../src/constants'

describe('scriptRunnerBrokenReferenceFilter', () => {
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let scriptedFieldsType: ObjectType
  let projectType: ObjectType
  let IssueTypeType: ObjectType
  let scriptedFieldInstance: InstanceElement
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
    projectInstance = new InstanceElement(
      'ProjectInstance',
      projectType,
    )
    issueTypeInstance = new InstanceElement(
      'IssueTypeInstance',
      IssueTypeType,
      { id: 'issueType1',
        name: 'IssueTypeName1' }
    )
    resolvedProject = new ReferenceExpression(projectInstance.elemID, projectInstance)
    unresolvedProject = new ReferenceExpression(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'missing_1'), undefined)
    resolvedIssueType = new ReferenceExpression(issueTypeInstance.elemID, issueTypeInstance)
    unresolvedIssueType = new ReferenceExpression(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'missing_2'), undefined)
    scriptedFieldInstance = new InstanceElement(
      'ScriptedFieldInstance',
      scriptedFieldsType,
      {
        projectKeys: [
          resolvedProject,
          unresolvedProject,
        ],
        issueTypes: [
          resolvedIssueType,
          unresolvedIssueType,
        ],
      },
    )
  })

  describe('preDeploy', () => {
    it('should remove unresolved project from the instance for adding and modification', async () => {
      const modificationInstance = scriptedFieldInstance.clone()
      const deletedInstance = scriptedFieldInstance.clone()
      await filter.preDeploy([
        toChange({ after: scriptedFieldInstance }),
        toChange({ before: scriptedFieldInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(scriptedFieldInstance.value.projectKeys).toHaveLength(1)
      expect(scriptedFieldInstance.value.issueTypes).toHaveLength(1)
      expect(modificationInstance.value.projectKeys).toHaveLength(1)
      expect(modificationInstance.value.issueTypes).toHaveLength(1)
      expect(deletedInstance.value.projectKeys).toHaveLength(2)
      expect(deletedInstance.value.issueTypes).toHaveLength(2)

      expect(scriptedFieldInstance.value.projectKeys[0])
        .toEqual(resolvedProject)
      expect(scriptedFieldInstance.value.issueTypes[0])
        .toEqual(resolvedIssueType)
      expect(modificationInstance.value.projectKeys[0])
        .toEqual(resolvedProject)
      expect(modificationInstance.value.issueTypes[0])
        .toEqual(resolvedIssueType)
      expect(deletedInstance.value.projectKeys)
        .toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.issueTypes)
        .toEqual([resolvedIssueType, unresolvedIssueType])
    })
  })

  describe('onDeploy', () => {
    it('should add back unresolved project references to the instance when adding or modifying', async () => {
      const modificationInstance = scriptedFieldInstance.clone()
      const deletedInstance = scriptedFieldInstance.clone()

      await filter.preDeploy([
        toChange({ after: scriptedFieldInstance }),
        toChange({ before: scriptedFieldInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(scriptedFieldInstance.value.projectKeys).toHaveLength(1)
      expect(modificationInstance.value.projectKeys).toHaveLength(1)
      expect(deletedInstance.value.projectKeys).toHaveLength(2)
      await filter.onDeploy([
        toChange({ after: scriptedFieldInstance }),
        toChange({ before: scriptedFieldInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(scriptedFieldInstance.value.projectKeys).toHaveLength(2)
      expect(scriptedFieldInstance.value.issueTypes).toHaveLength(2)
      expect(modificationInstance.value.projectKeys).toHaveLength(2)
      expect(modificationInstance.value.issueTypes).toHaveLength(2)
      expect(deletedInstance.value.projectKeys).toHaveLength(2)
      expect(deletedInstance.value.issueTypes).toHaveLength(2)


      expect(scriptedFieldInstance.value.projectKeys)
        .toEqual([resolvedProject, unresolvedProject])
      expect(scriptedFieldInstance.value.issueTypes)
        .toEqual([resolvedIssueType, unresolvedIssueType])
      expect(modificationInstance.value.projectKeys)
        .toEqual([resolvedProject, unresolvedProject])
      expect(modificationInstance.value.issueTypes)
        .toEqual([resolvedIssueType, unresolvedIssueType])
      expect(deletedInstance.value.projectKeys)
        .toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.issueTypes)
        .toEqual([resolvedIssueType, unresolvedIssueType])
    })
    it('should not crash if onDeployCalled without predeploy', async () => {
      await filter.onDeploy([
        toChange({ after: scriptedFieldInstance }),
      ])
      expect(scriptedFieldInstance.value.projectKeys).toHaveLength(2)
      expect(scriptedFieldInstance.value.issueTypes).toHaveLength(2)
    })
  })
})
