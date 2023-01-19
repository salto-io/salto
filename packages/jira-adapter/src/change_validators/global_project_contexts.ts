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
import { Change, ChangeError, ChangeValidator, getChangeData, InstanceElement, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isReferenceExpression, isRemovalOrModificationChange, ReferenceExpression, Element } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { PROJECT_CONTEXTS_FIELD } from '../filters/fields/contexts_projects_filter'
import { PROJECT_TYPE } from '../constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../filters/fields/constants'

const { awu } = collections.asynciterable
const log = logger(module)


const getGlobalContextsUsedInProjectErrors = (
  globalContexts: InstanceElement[],
  projects: InstanceElement[],
): ChangeError[] =>
  globalContexts
    .filter(context => context.value.isGlobalContext)
    .map(context => {
      const referencingProjects = projects.filter(project => {
        const projectContexts = project.value[PROJECT_CONTEXTS_FIELD]
        return projectContexts && projectContexts.includes(context.elemID.getFullName())
      })
      return {
        context,
        referencingProjects,
      }
    }).filter(({ referencingProjects }) => referencingProjects.length > 0)
    .map(({ context, referencingProjects }) => ({
      elemID: context.elemID,
      severity: 'Error' as const,
      message: 'Global field context can’t be referenced by a project.',
      detailedMessage: `This field context is global, but the following projects still reference it: ${referencingProjects.map(project => project.elemID.name)} Global field contexts can’t be referenced by projects. Please change this context to a non-global one, or add the projects without the reference to this deployment`,
    }))

const getContextsNotUsedInProjectErrors = (
  contexts: InstanceElement[],
  projectContexts: Set<string>,
  idToChange: Record<string, Change<Element>>,
): ChangeError[] => {
  const nonReferencedContexts = contexts.filter(
    context => !projectContexts.has(context.elemID.getFullName())
  )

  const nonReferencedNewContexts = nonReferencedContexts.filter(
    context => context.elemID.getFullName() in idToChange
      && isAdditionChange(idToChange[context.elemID.getFullName()])
  )

  return nonReferencedNewContexts
    .filter(context => !context.value.isGlobalContext)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Field context is not used in any project',
      detailedMessage: `The context ${instance.elemID.getFullName()} is not used by any project and it is not a global context, so it cannot be created (this is generally safe to ignore, as this context would not have an effect on the account).`,
    }))
}

const getProjectRemovedContextsErrors = (
  contexts: InstanceElement[],
  projectContexts: Set<string>,
  idToChange: Record<string, Change<Element>>,
): ChangeError[] => {
  const nonReferencedContexts = contexts.filter(
    context => !projectContexts.has(context.elemID.getFullName())
  )

  const nonReferencedExistingContexts = nonReferencedContexts.filter(
    context => !(context.elemID.getFullName() in idToChange
      && isAdditionChange(idToChange[context.elemID.getFullName()]))
  )


  return Object.values(idToChange)
    .filter(change => getChangeData(change).elemID.typeName === PROJECT_TYPE)
    .filter(isInstanceChange)
    .map(change => {
      const beforeContexts = new Set(isRemovalOrModificationChange(change)
        ? change.data.before.value[PROJECT_CONTEXTS_FIELD]
          ?.map((ref: ReferenceExpression) => ref.elemID.getFullName()) ?? []
        : [])
      const afterContexts = new Set(isAdditionOrModificationChange(change)
        ? change.data.after.value[PROJECT_CONTEXTS_FIELD]
          ?.map((ref: ReferenceExpression) => ref.elemID.getFullName()) ?? []
        : [])

      return {
        instance: getChangeData(change),
        removedContexts: nonReferencedExistingContexts.filter(
          context => beforeContexts.has(context.elemID.getFullName())
            && !afterContexts.has(context.elemID.getFullName())
        ),
      }
    })
    .filter(({ removedContexts }) => removedContexts.length > 0)
    .map(({ instance, removedContexts }) => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Cannot remove field context from a project',
      detailedMessage: `A field context which is not global must be referenced by at least one project. The deployment of ${instance.elemID.getFullName()} will result in the following contexts having no references: ${removedContexts.map(context => context.elemID.getFullName()).join(', ')}. Therefore, the project cannot be deployed.
To solve this, either modify the project to keep a reference to these contexts, or remove the contexts from the workspace`,
    }))
}

/**
 * Verify that the field context 'isGlobalContext' matches the project types that uses it
 */
export const globalProjectContextsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }

  const ids = await awu(await elementSource.list()).toArray()

  const projects = await awu(ids)
    .filter(id => id.typeName === PROJECT_TYPE)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()

  const contexts = await awu(ids)
    .filter(id => id.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()

  const projectContexts = new Set(projects
    .flatMap(proj => proj.value[PROJECT_CONTEXTS_FIELD] ?? [])
    .filter(ref => {
      if (!isReferenceExpression(ref)) {
        log.warn(`Found a non reference expression in ${PROJECT_CONTEXTS_FIELD}`)
        return false
      }
      return true
    })
    .map(ref => ref.elemID.getFullName()))


  const idToChange = _.keyBy(changes, change => getChangeData(change).elemID.getFullName())

  return [
    ...getGlobalContextsUsedInProjectErrors(contexts, projects),
    ...getContextsNotUsedInProjectErrors(contexts, projectContexts, idToChange),
    ...getProjectRemovedContextsErrors(contexts, projectContexts, idToChange),
  ]
}
