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

import { FixElementsFunc, GetCustomReferencesFunc, InstanceElement, ReferenceInfo, isInstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import Joi from 'joi'
import { collections, values } from '@salto-io/lowerdash'
import { AUTOMATION_TYPE } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'

const { awu } = collections.asynciterable

type AutomationProjects = {
  projectId: unknown
}[]

const AUTOMATION_PROJECTS_SCHEME = Joi.array().items(
  Joi.object({
    projectId: Joi.optional(),
  }).unknown(true),
)

const isAutomationProjects = createSchemeGuard<AutomationProjects>(AUTOMATION_PROJECTS_SCHEME, 'Received an invalid automation projects value')

const getProjectReferences = async (
  instance: InstanceElement,
): Promise<ReferenceInfo[]> => {
  const automationProjects = instance.value.projects
  if (!isAutomationProjects(automationProjects)) {
    return []
  }

  return awu(automationProjects)
    .map(async (proj, index) => (
      isReferenceExpression(proj.projectId)
        ? { source: instance.elemID.createNestedID(index.toString(), 'projectId'), target: proj.projectId.elemID, type: 'weak' as const }
        : undefined))
    .filter(values.isDefined)
    .toArray()
}

/**
 * Marks each project reference in automation as a weak reference.
 */
const getAutomationProjectsReferences: GetCustomReferencesFunc = async elements =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .flatMap(instance => getProjectReferences(instance))
    .toArray()

/**
 * Remove invalid projects (not references or missing references) from automations.
 */
const removeMissingAutomationProjects: WeakReferencesHandler['removeWeakReferences'] = ({ elementsSource })
: FixElementsFunc => async elements => {
  const fixedElements = await awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === AUTOMATION_TYPE)
    .map(async instance => {
      const automationProjects = instance.value.projects
      if (!isAutomationProjects(automationProjects)) {
        return undefined
      }

      const fixedInstance = instance.clone()
      fixedInstance.value.projects = await awu(automationProjects)
        .filter(async proj => (proj.projectId === undefined
          || (
            isReferenceExpression(proj.projectId)
            // eslint-disable-next-line no-return-await
            && await elementsSource.has(proj.projectId.elemID)
          )))
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
    message: 'Removed missing projects',
    detailedMessage: 'Automation included projects that do not exist in the current environment. These projects were removed from the automation.',
  }))
  return { fixedElements, errors }
}

export const automationProjectsHandler: WeakReferencesHandler = {
  findWeakReferences: getAutomationProjectsReferences,
  removeWeakReferences: removeMissingAutomationProjects,
}
