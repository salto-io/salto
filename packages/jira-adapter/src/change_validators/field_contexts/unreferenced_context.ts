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
import { ChangeError, ChangeValidator, InstanceElement, isReferenceExpression, ReferenceExpression, ElemID } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { isDefined } from '@salto-io/lowerdash/src/values'
import { PROJECT_CONTEXTS_FIELD } from '../../filters/fields/contexts_projects_filter'
import { PROJECT_TYPE } from '../../constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'

const { awu } = collections.asynciterable
const log = logger(module)

const getUnreferencedContextErrors = (
  contexts: InstanceElement[],
  fieldsToContexts: Record<string, ElemID[]>,
  projectContexts: Set<string>,
): ChangeError[] =>
  Object.entries(fieldsToContexts).map(([_field, fieldContexts]) => {
    const fieldContextsIds = contexts
      .filter(context => isReferenceExpression(context))
      .map(context => context.elemID)
    const notFoundContexts = fieldContextsIds.filter(context => !projectContexts.has(context.getFullName()))
    if (notFoundContexts.length > 0) {
      if (notFoundContexts.length !== fieldContexts.length) {
        return notFoundContexts.map(context => ({
          elemID: context,
          severity: 'Error' as const,
          message: 'Non-global field context not referenced by any project. There are other valid contexts.',
          detailedMessage: 'This field context is not global and isn’t referenced by any project, and can’t be deployed. However, the field has other valid contexts, so it’s probably safe to continue without this context. Learn more: https://docs.salto.io/docs/non-global-field-context-not-referenced-by-any-project-and-cant-be-deployed',
        }))
      }
      return notFoundContexts.map(context => ({
        elemID: context,
        severity: 'Error' as const,
        message: 'Non-global field context not referenced by any project.',
        detailedMessage: 'This field context is not global and isn’t referenced by any project, and can’t be deployed. In order to deploy this context, either make it global, or include the Project which references it in your deployment. Learn more: https://docs.salto.io/docs/non-global-field-context-not-referenced-by-any-project-and-cant-be-deployed',
      }))
    }
  }).filter(isDefined).flat()

/**
 * Verify that the field context is referenced by a project.
 */
export const globalProjectContextsValidator: ChangeValidator = async (_changes, elementSource) => {
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

  const fields = await awu(ids)
    .filter(id => id.typeName === 'Field')
    .filter(id => id.idType === 'instance')
    .map(id => elementSource.get(id))
    .toArray()
  const fieldsToContexts = Object.fromEntries(fields
    .map(field => [
      field.elemID.getFullName(),
      field.value.contexts.filter((ref: ReferenceExpression) => {
        if (!isReferenceExpression(ref)) {
          log.warn(`Found a non reference expression in field ${field.elemID.getFullName()}`)
          return false
        }
        return true
      }).map((context: ReferenceExpression) => context.elemID),
    ]))
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

  return getUnreferencedContextErrors(contexts, fieldsToContexts, projectContexts)
}
