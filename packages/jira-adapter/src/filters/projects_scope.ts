/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  ElemID,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import {
  getParentOrUndefined,
  isResolvedReferenceExpression,
  walkOnValue,
  WALK_NEXT_STEP,
} from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { AUTOMATION_TYPE, BOARD_TYPE_NAME, FIELD_TYPE, PROJECT_TYPE } from '../constants'
import { FIELD_CONTEXT_TYPE_NAME } from './fields/constants'

const log = logger(module)
const { makeArray } = collections.array

export const PROJECT_SCOPE_FIELD_NAME = 'projectsScope'

type BoardWithProjectId = {
  location: {
    projectId: ReferenceExpression
  }
}

const isBoardWithProjectId = (element: unknown): element is InstanceElement & { value: BoardWithProjectId } =>
  isInstanceElement(element) &&
  element.elemID.typeName === BOARD_TYPE_NAME &&
  isReferenceExpression(element.value.location?.projectId)

type AutomationWithProjectId = {
  projects: {
    projectId?: ReferenceExpression
  }[]
}

const isAutomationWithProjectId = (element: unknown): element is InstanceElement & { value: AutomationWithProjectId } =>
  isInstanceElement(element) &&
  element.elemID.typeName === AUTOMATION_TYPE &&
  Array.isArray(element.value.projects) &&
  element.value.projects.some((projectInfo: { projectId: unknown }) => isReferenceExpression(projectInfo.projectId))

type ContextWithProjectIds = {
  projectIds: ReferenceExpression[]
}

const isContextWithProjectIds = (element: unknown): element is InstanceElement & { value: ContextWithProjectIds } =>
  isInstanceElement(element) &&
  element.elemID.typeName === FIELD_CONTEXT_TYPE_NAME &&
  Array.isArray(element.value.projectIds) &&
  element.value.projectIds.every(isReferenceExpression)

type ProjectScopeInfo = {
  instance: InstanceElement
  projectKeys: Set<string>
}

const getProjectScope = (project: InstanceElement, projectChildren: InstanceElement[]): ElemID[] => {
  // for each project we retrieve all the instances that this project tree contains
  const instances = [project, ...projectChildren]
  const instancesToWalkOn = instances
  const instanceScope = Object.fromEntries(instances.map(instance => [instance.elemID.getFullName(), instance.elemID]))

  const getInstanceReferences = (inst: InstanceElement): void => {
    walkOnValue({
      elemId: inst.elemID,
      value: inst.value,
      func: ({ value, path }) => {
        if (isResolvedReferenceExpression(value)) {
          if (path.typeName === FIELD_TYPE && value.elemID.typeName === FIELD_CONTEXT_TYPE_NAME) {
            const contextValue = value.value.value
            // we don't want to add other projects contexts to the project scope,
            // therefore we skip all contexts that are not global.
            // the project contexts are handled in the context section (addContextsToProjectScope)
            if (makeArray(contextValue.projectIds).length > 0) {
              return WALK_NEXT_STEP.SKIP
            }
          }
          // prevent infinite loop
          if (value.elemID.typeName === PROJECT_TYPE) {
            return WALK_NEXT_STEP.SKIP
          }
          instanceScope[value.elemID.getFullName()] = value.elemID
          instancesToWalkOn.push(value.value)
          return WALK_NEXT_STEP.SKIP
        }
        return WALK_NEXT_STEP.RECURSE
      },
    })
  }

  while (instancesToWalkOn.length > 0) {
    const currentInstance = instancesToWalkOn.pop()
    if (currentInstance === undefined) {
      break
    }
    getInstanceReferences(currentInstance)
  }
  return Object.values(instanceScope)
}

const getInstanceChildrenTree = (
  instance: InstanceElement,
  instanceFullNameToChildren: Record<string, InstanceElement[]>,
): InstanceElement[] => {
  const instanceChildren = []
  const instancesToWalkOn = [instance]
  const walkedInstancesFullName = new Set<string>()

  while (instancesToWalkOn.length > 0) {
    const currentInstance = instancesToWalkOn.pop()
    if (currentInstance === undefined) {
      break
    }
    walkedInstancesFullName.add(currentInstance.elemID.getFullName())
    const currentChildren = instanceFullNameToChildren[currentInstance.elemID.getFullName()]
    if (currentChildren !== undefined) {
      const childrenToWalkOn = currentChildren.filter(child => !walkedInstancesFullName.has(child.elemID.getFullName()))
      instanceChildren.push(...childrenToWalkOn)
      instancesToWalkOn.push(...childrenToWalkOn)
    }
  }
  return instanceChildren
}

const addBoardsToProjectScope = (
  instances: InstanceElement[],
  projectFullNameToScope: Record<string, InstanceElement[]>,
): void => {
  instances.filter(isBoardWithProjectId).forEach(board => {
    const projectRef = board.value.location.projectId
    if (projectFullNameToScope[projectRef.elemID.getFullName()] === undefined) {
      projectFullNameToScope[projectRef.elemID.getFullName()] = []
    }
    projectFullNameToScope[projectRef.elemID.getFullName()].push(board)
  })
}

const addAutomationsToProjectScope = (
  instances: InstanceElement[],
  projectFullNameToScope: Record<string, InstanceElement[]>,
): void => {
  instances.filter(isAutomationWithProjectId).forEach(automation => {
    automation.value.projects.forEach(automationProject => {
      const projectRef = automationProject.projectId
      if (!isReferenceExpression(projectRef)) {
        return
      }
      if (projectFullNameToScope[projectRef.elemID.getFullName()] === undefined) {
        projectFullNameToScope[projectRef.elemID.getFullName()] = []
      }
      projectFullNameToScope[projectRef.elemID.getFullName()].push(automation)
    })
  })
}

const addContextsToProjectScope = (
  instances: InstanceElement[],
  projectFullNameToScope: Record<string, InstanceElement[]>,
): void => {
  instances.filter(isContextWithProjectIds).forEach(context => {
    const { projectIds } = context.value
    projectIds.forEach(projectId => {
      if (projectFullNameToScope[projectId.elemID.getFullName()] === undefined) {
        projectFullNameToScope[projectId.elemID.getFullName()] = []
      }
      projectFullNameToScope[projectId.elemID.getFullName()].push(context)
    })
  })
}

const getProjectFullNameToScope = (instances: InstanceElement[]): Record<string, InstanceElement[]> => {
  const projectFullNameToScope: Record<string, InstanceElement[]> = {}
  addBoardsToProjectScope(instances, projectFullNameToScope)
  addAutomationsToProjectScope(instances, projectFullNameToScope)
  addContextsToProjectScope(instances, projectFullNameToScope)
  return projectFullNameToScope
}

const getInstanceFullNameToChildren = (instances: InstanceElement[]): Record<string, InstanceElement[]> => {
  const instanceFullNameToChildren: Record<string, InstanceElement[]> = {}
  instances.forEach(instance => {
    const parent = getParentOrUndefined(instance)
    if (parent !== undefined) {
      if (instanceFullNameToChildren[parent.elemID.getFullName()] === undefined) {
        instanceFullNameToChildren[parent.elemID.getFullName()] = []
      }
      instanceFullNameToChildren[parent.elemID.getFullName()].push(instance)
    }
  })
  return instanceFullNameToChildren
}

const getProjectsScopeInfo = (
  instances: InstanceElement[],
  projectFullNameToScope: Record<string, InstanceElement[]>,
): ProjectScopeInfo[] => {
  const instanceNameToProjectScopeInfo: Record<string, ProjectScopeInfo> = Object.fromEntries(
    instances.map(instance => [
      instance.elemID.getFullName(),
      {
        instance,
        projectKeys: new Set(),
      },
    ]),
  )
  const instanceFullNameToChildren = getInstanceFullNameToChildren(instances)

  instances
    .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
    .forEach(project => {
      const projectChildren = getInstanceChildrenTree(project, instanceFullNameToChildren)
      const instancesReferringToProject = _.unionBy(
        projectFullNameToScope[project.elemID.getFullName()] ?? [],
        instance => instance.elemID.getFullName(),
      )
      const scope = getProjectScope(project, projectChildren.concat(instancesReferringToProject))
      scope.forEach(elemId => {
        const topLevelElemId = elemId.isTopLevel() ? elemId : elemId.createTopLevelParentID().parent
        const fullName = topLevelElemId.getFullName()
        if (instanceNameToProjectScopeInfo[fullName]?.projectKeys !== undefined) {
          instanceNameToProjectScopeInfo[fullName].projectKeys.add(project.value.key)
        }
      })
    })
  return Object.values(instanceNameToProjectScopeInfo)
}

/**
 * This filter adds a hidden and important value field projectsScope to every instance's object type.
 * The projectsScope field is a list of projects keys that the instance is in scope of.
 * The scope is determined by:
 * - references from projects (recursively)
 * - project children (recursively)
 * - Boards, CustomFieldContext and Automation that referring the project
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'projectScopeFilter',
  onFetch: async (elements: Element[]) => {
    if (!config.fetch.enableProjectsScope) {
      return
    }
    const instances = elements.filter(isInstanceElement)

    const projectFullNameToScope = getProjectFullNameToScope(instances)
    const projectsScopeInfo = getProjectsScopeInfo(instances, projectFullNameToScope)

    // Add projectScope field to all relevant instances
    projectsScopeInfo.forEach(scopeInfo => {
      if (scopeInfo.projectKeys.size > 0) {
        log.trace(
          `adding projectsScope to ${scopeInfo.instance.elemID.getFullName()} with value: ${scopeInfo.projectKeys}`,
        )
        scopeInfo.instance.value.projectsScope = Array.from(scopeInfo.projectKeys)
      }
    })
  },
})

export default filter
