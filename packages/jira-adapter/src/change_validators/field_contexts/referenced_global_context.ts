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
import { ChangeError, InstanceElement } from '@salto-io/adapter-api'
import { PROJECT_CONTEXTS_FIELD } from '../../filters/fields/contexts_projects_filter'

export const getGlobalContextsUsedInProjectErrors = (
  contexts: InstanceElement[],
  projects: InstanceElement[],
): ChangeError[] =>
  contexts
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
