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
  isTemplateExpression,
  ReferenceExpression,
  TemplateExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { AUTOMATION_TYPE, BOARD_TYPE_NAME, PROJECT_TYPE } from '../constants'
import { getChildren, getScope } from '../utils'

const log = logger(module)

const formatElemIds = (elemIds: ElemID[]): string =>
  elemIds.map(e => e.getFullName()).join(`,
`)

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
  element.value.projects !== undefined &&
  element.value.projects.some((project: { projectId: unknown }) => isReferenceExpression(project.projectId))

type FilterWithJql = {
  jql: TemplateExpression
}

const isFilterWithJql = (element: unknown): element is InstanceElement & { value: FilterWithJql } =>
  isInstanceElement(element) && isTemplateExpression(element.value.jql)

/**
 * TODO add description
 */
const filter: FilterCreator = () => ({
  name: 'projectScopeFilter',
  onFetch: async (elements: Element[]) => {
    // TODO: add a FF
    const projectNameToScope: Record<string, ElemID[]> = {}
    const projects = elements.filter(isInstanceElement).filter(element => element.elemID.typeName === PROJECT_TYPE)
    projects.forEach(project => {
      const scope = getScope(project)
      projectNameToScope[project.elemID.getFullName()] = scope
    })

    projects.forEach(project => {
      const children = getChildren(project, elements)
      if (children.length !== 0) {
        log.info(`The project ${project.elemID.getFullName()} has ${children.length} children:
        ${formatElemIds(children)}`)
      }
      const scope = projectNameToScope[project.elemID.getFullName()].concat(children)
      log.info(`The project ${project.elemID.getFullName()} has ${scope.length} instances in his scope:
      ${formatElemIds(scope)}`)
    })

    // Boards
    elements.filter(isBoardWithProjectId).forEach(board => {
      const projectRef = board.value.location.projectId
      if (projectNameToScope[projectRef.elemID.getFullName()] === undefined) {
        log.info(`The project ${projectRef.elemID.getFullName()} is not in the scope map`)
      } else {
        projectNameToScope[projectRef.elemID.getFullName()].push(board.elemID)
      }
    })

    // Automations
    elements.filter(isAutomationWithProjectId).forEach(automation => {
      automation.value.projects.forEach(projectInfo => {
        if (!isReferenceExpression(projectInfo.projectId)) {
          return
        }
        if (projectNameToScope[projectInfo.projectId.elemID.getFullName()] === undefined) {
          log.info(`The project ${projectInfo.projectId.elemID.getFullName()} is not in the scope map`)
        } else {
          projectNameToScope[projectInfo.projectId.elemID.getFullName()].push(automation.elemID)
        }
      })
    })

    // Filters
    elements.filter(isFilterWithJql).forEach(filterInstance => {
      const { jql } = filterInstance.value
      const jqlParts = jql.parts
      jqlParts
        .filter(isReferenceExpression)
        .filter(partRef => partRef.elemID.typeName === PROJECT_TYPE)
        .forEach(partRef => {
          // the jql refer to project key or name
          const { parent } = partRef.elemID.createBaseID()
          if (parent.typeName)
            if (projectNameToScope[parent.getFullName()] === undefined) {
              log.info(`The project ${parent.getFullName()} is not in the scope map`)
            } else {
              projectNameToScope[parent.getFullName()].push(filterInstance.elemID)
            }
        })
    })

    const projectNameToMaxScope = _.maxBy(Object.entries(projectNameToScope), ([, scope]) => scope.length)
    if (projectNameToMaxScope === undefined) {
      return
    }
    log.info(
      `The project with the most instances in his scope is ${projectNameToMaxScope[0]} and it has ${projectNameToMaxScope[1].length} instances`,
    )
  },
})

export default filter
