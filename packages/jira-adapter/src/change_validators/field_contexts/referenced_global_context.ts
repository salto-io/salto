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
import { ChangeError, ChangeValidator, InstanceElement, isReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { PROJECT_CONTEXTS_FIELD } from '../../filters/fields/contexts_projects_filter'
import { PROJECT_TYPE } from '../../constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'

const { awu } = collections.asynciterable


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

/**
 * Verify that no global contexts are referenced in projects
 */
export const globalProjectContextsValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined || changes.length === 0) {
    return []
  }

  const ids = await awu(await elementSource.list()).toArray()
  const globalContexts = await awu(ids)
    .filter(id => id.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .filter(context => context.value.isGlobalContext)
    .toArray()

  const projects = await awu(ids)
    .filter(id => id.typeName === PROJECT_TYPE)
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()

  return getGlobalContextsUsedInProjectErrors(globalContexts, projects)
}
