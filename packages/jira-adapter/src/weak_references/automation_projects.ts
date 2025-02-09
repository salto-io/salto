/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  GetCustomReferencesFunc,
  InstanceElement,
  ReferenceInfo,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { AUTOMATION_TYPE } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'

const { awu } = collections.asynciterable

const log = logger(module)

type AutomationProjects = {
  projectId: unknown
}[]

const AUTOMATION_PROJECTS_SCHEME = Joi.array().items(
  Joi.object({
    projectId: Joi.optional(),
  }).unknown(true),
)

const isAutomationProjects = createSchemeGuard<AutomationProjects>(
  AUTOMATION_PROJECTS_SCHEME,
  'Received an invalid automation projects value',
)

const getProjectReferences = (instance: InstanceElement): ReferenceInfo[] => {
  const automationProjects = instance.value.projects
  if (automationProjects === undefined || !isAutomationProjects(automationProjects)) {
    log.warn(
      `projects value is corrupted in instance ${instance.elemID.getFullName()}, hence not calculating projects weak references`,
    )
    return []
  }

  return automationProjects
    .map((proj, index) =>
      isReferenceExpression(proj.projectId)
        ? {
            source: instance.elemID.createNestedID(index.toString(), 'projectId'),
            target: proj.projectId.elemID,
            type: 'weak' as const,
          }
        : undefined,
    )
    .filter(values.isDefined)
}

/**
 * Marks each project reference in automation as a weak reference.
 */
const getAutomationProjectsReferences: GetCustomReferencesFunc = async elements =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .flatMap(getProjectReferences)
    .toArray()

/**
 * Remove invalid projects (not references or missing references) from automations.
 */
const removeMissingAutomationProjects: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async elements => {
    const fixedElements = await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
      .map(async instance => {
        const automationProjects = instance.value.projects
        if (automationProjects === undefined || !isAutomationProjects(automationProjects)) {
          log.warn(
            `projects value is corrupted in instance ${instance.elemID.getFullName()}, hence not omitting missing projects`,
          )
          return undefined
        }

        const fixedInstance = instance.clone()
        fixedInstance.value.projects = await awu(automationProjects)
          .filter(
            async proj =>
              proj.projectId === undefined ||
              // consider changing, if it is not a reference expression it is not a weak reference
              (isReferenceExpression(proj.projectId) &&
                // eslint-disable-next-line no-return-await
                (await elementsSource.has(proj.projectId.elemID))),
          )
          .toArray()

        if (fixedInstance.value.projects.length === instance.value.projects.length) {
          return undefined
        }

        return fixedInstance
      })
      .filter(values.isDefined)
      .toArray()

    const errors = fixedElements.map(instance => ({
      elemID: instance.elemID.createNestedID('projects'),
      severity: 'Info' as const,
      message: 'Deploying automation without all attached projects',
      detailedMessage:
        'This automation is attached to some projects that do not exist in the target environment. It will be deployed without referencing these projects.',
    }))
    return { fixedElements, errors }
  }

export const automationProjectsHandler: WeakReferencesHandler = {
  findWeakReferences: getAutomationProjectsReferences,
  removeWeakReferences: removeMissingAutomationProjects,
}
