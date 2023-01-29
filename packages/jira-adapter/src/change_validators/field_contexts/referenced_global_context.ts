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
import { ChangeError, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash'

const { isDefined } = values

const getGlobalContextsUsedInProjectError = (id: ElemID, referencingProjects: string[]): ChangeError => ({
  elemID: id,
  severity: 'Error' as const,
  message: 'Global field context can’t be referenced by a project.',
  detailedMessage: `This field context is global, but the following projects still reference it: ${referencingProjects.join(',')}. Global field contexts can’t be referenced by projects. Please change this context to a non-global one, or add the projects without the reference to this deployment.`,
})

export const getGlobalContextsUsedInProjectErrors = (
  contexts: InstanceElement[],
  projectsToContexts: Record<string, Set<string>>,
): ChangeError[] =>
  contexts
    .filter(context => context.value.isGlobalContext)
    .map(context => {
      const referencingProjects = Object.entries(projectsToContexts)
        .filter(([_project, projectContexts]) => projectContexts.has(context.elemID.getFullName()))
        .map(([project, _projectContexts]) => project)
      if (referencingProjects.length > 0) {
        return getGlobalContextsUsedInProjectError(context.elemID, referencingProjects)
      }
      return undefined
    }).filter(isDefined).flat()
