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

import { ElemID, InstanceElement, ObjectType, toChange, ReferenceExpression, UnresolvedReference } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { ProjectType } from '../../../src/change_validators/automation_unresolved_references'
import { getFilterParams } from '../../utils'
import automationProjectBrokenReferenceFilter from '../../../src/filters/automation/automation_project_broken_reference'
import { AUTOMATION_TYPE, JIRA, PROJECT_TYPE } from '../../../src/constants'

describe('automationProjectBrokenReferenceFilter', () => {
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let automationType: ObjectType
  let projectType: ObjectType
  let automationInstance: InstanceElement
  let projectInstance: InstanceElement
  let unresolvedElemId: ElemID
  let unresolvedProject: ProjectType
  let resolvedProject: ProjectType


  beforeEach(async () => {
    filter = automationProjectBrokenReferenceFilter(getFilterParams()) as filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
    automationType = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
    unresolvedElemId = new ElemID(JIRA, 'unresolved')
    projectType = new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) })
    unresolvedProject = {
      projectId: new ReferenceExpression(projectType.elemID,
        new UnresolvedReference(unresolvedElemId)),
    }
    resolvedProject = {
      projectId: new ReferenceExpression(projectType.elemID,
        { projectId: projectInstance }),
    }
    projectInstance = new InstanceElement(
      'ProjectInstance',
      projectType,
    )
    automationInstance = new InstanceElement(
      'AutomationInstance',
      automationType,
      {
        projects: [
          resolvedProject,
          unresolvedProject,
        ],
      },
    )
  })

  describe('preDeploy', () => {
    it('should remove unresolved project from the instance for adding and modification', async () => {
      expect(automationInstance.value.projects).toHaveLength(2)
      const modificationInstance = automationInstance.clone()
      const deletedInstance = automationInstance.clone()
      await filter.preDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: automationInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(automationInstance.value.projects).toHaveLength(1)
      expect(modificationInstance.value.projects).toHaveLength(1)
      expect(deletedInstance.value.projects).toHaveLength(2)

      expect(automationInstance.value.projects[0])
        .toEqual(resolvedProject)
      expect(modificationInstance.value.projects[0])
        .toEqual(resolvedProject,)
      expect(deletedInstance.value.projects)
        .toEqual([resolvedProject, unresolvedProject])
    })

    it('should not remove project resolved references from the instance', async () => {
      automationInstance.value.projects = [
        resolvedProject,
        resolvedProject,
      ]
      expect(automationInstance.value.projects).toHaveLength(2)
      const modificationInstance = automationInstance.clone()
      const deletedInstance = automationInstance.clone()
      await filter.preDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: automationInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(automationInstance.value.projects).toHaveLength(2)
      expect(modificationInstance.value.projects).toHaveLength(2)
      expect(deletedInstance.value.projects).toHaveLength(2)

      expect(automationInstance.value.projects)
        .toEqual([resolvedProject, resolvedProject])
      expect(modificationInstance.value.projects)
        .toEqual([resolvedProject, resolvedProject])
      expect(deletedInstance.value.projects)
        .toEqual([resolvedProject, resolvedProject])
    })
    it('should not remove project type key elements', async () => {
      const projectTypeKey = { projectTypeKey: 'business' }
      automationInstance.value.projects = [
        resolvedProject,
        unresolvedProject,
        projectTypeKey,
      ]
      expect(automationInstance.value.projects).toHaveLength(3)
      const modificationInstance = automationInstance.clone()
      const deletedInstance = automationInstance.clone()
      await filter.preDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: automationInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(automationInstance.value.projects).toHaveLength(2)
      expect(modificationInstance.value.projects).toHaveLength(2)
      expect(deletedInstance.value.projects).toHaveLength(3)

      expect(automationInstance.value.projects)
        .toEqual([resolvedProject, projectTypeKey])
      expect(modificationInstance.value.projects)
        .toEqual([resolvedProject, projectTypeKey])
      expect(deletedInstance.value.projects)
        .toEqual([resolvedProject, unresolvedProject, projectTypeKey])
    })
  })

  describe('onDeploy', () => {
    it('should add back unresolved project references to the instance when adding or modifying', async () => {
      expect(automationInstance.value.projects).toHaveLength(2)
      const modificationInstance = automationInstance.clone()
      const deletedInstance = automationInstance.clone()

      await filter.preDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: automationInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(automationInstance.value.projects).toHaveLength(1)
      expect(modificationInstance.value.projects).toHaveLength(1)
      expect(deletedInstance.value.projects).toHaveLength(2)
      await filter.onDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: automationInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(automationInstance.value.projects).toHaveLength(2)
      expect(modificationInstance.value.projects).toHaveLength(2)
      expect(deletedInstance.value.projects).toHaveLength(2)

      expect(automationInstance.value.projects)
        .toEqual([resolvedProject, unresolvedProject])
      expect(modificationInstance.value.projects)
        .toEqual([resolvedProject, unresolvedProject])
      expect(deletedInstance.value.projects)
        .toEqual([resolvedProject, unresolvedProject])
    })
    it('should not add nothing when all project references are resolved', async () => {
      automationInstance.value.projects = [
        resolvedProject,
        resolvedProject,
      ]
      expect(automationInstance.value.projects).toHaveLength(2)
      const modificationInstance = automationInstance.clone()
      const deletedInstance = automationInstance.clone()

      await filter.preDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: automationInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(automationInstance.value.projects).toHaveLength(2)
      expect(modificationInstance.value.projects).toHaveLength(2)
      expect(deletedInstance.value.projects).toHaveLength(2)

      await filter.onDeploy([
        toChange({ after: automationInstance }),
        toChange({ before: automationInstance, after: modificationInstance }),
        toChange({ before: deletedInstance })])

      expect(automationInstance.value.projects).toHaveLength(2)
      expect(modificationInstance.value.projects).toHaveLength(2)
      expect(deletedInstance.value.projects).toHaveLength(2)

      expect(automationInstance.value.projects)
        .toEqual([resolvedProject, resolvedProject],)
      expect(modificationInstance.value.projects)
        .toEqual([resolvedProject, resolvedProject],)
      expect(deletedInstance.value.projects)
        .toEqual([resolvedProject, resolvedProject],)
    })
  })
})
