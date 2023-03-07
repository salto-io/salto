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
import { ChangeValidator, getChangeData, InstanceElement, isInstanceElement, isReferenceExpression, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { PROJECT_CONTEXTS_FIELD } from '../../filters/fields/contexts_projects_filter'
import { PROJECT_TYPE } from '../../constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { getUnreferencedContextErrors } from './unreferenced_context'
import { getGlobalContextsUsedInProjectErrors } from './referenced_global_context'

const { awu } = collections.asynciterable
const log = logger(module)

const getFieldContexts = async (
  field: InstanceElement,
  elementSource: ReadOnlyElementsSource,
): Promise<InstanceElement[]> =>
  awu(field.value.contexts)
    .filter((ref): ref is ReferenceExpression => {
      if (!isReferenceExpression(ref)) {
        log.warn(`Found a non reference expression in field ${field.elemID.getFullName()}`)
        return false
      }
      return true
    })
    .map((ref: ReferenceExpression) => ref.getResolvedValue(elementSource))
    .filter(isInstanceElement)
    .toArray()

/**
 * Verify that the field contexts are valid.
 */
export const fieldContextValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  if (!changes.find(change =>
    [PROJECT_TYPE, FIELD_CONTEXT_TYPE_NAME].includes(getChangeData(change).elemID.typeName))) {
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
  const fieldsToContexts = Object.fromEntries(await awu(fields
    .filter(field => field.value.contexts !== undefined))
    .map(async field => [
      field.elemID.getFullName(),
      await getFieldContexts(field, elementSource),
    ]).toArray())
  const projectNamesToContexts: Record<string, Set<string>> = Object.fromEntries(projects
    .filter(project => project.value[PROJECT_CONTEXTS_FIELD] !== undefined)
    .map(project => [
      project.elemID.name,
      new Set(project.value[PROJECT_CONTEXTS_FIELD].filter((ref: ReferenceExpression) => {
        if (!isReferenceExpression(ref)) {
          log.warn(`Found a non reference expression in project ${project.elemID.getFullName()}`)
          return false
        }
        return true
      }).map((context: ReferenceExpression) => context.elemID.getFullName())),
    ]))
  const mergedContexts = Object.values(projectNamesToContexts).reduce((acc, projectContexts) => {
    projectContexts.forEach(context => acc.add(context))
    return acc
  }, new Set<string>())

  return [
    ...getUnreferencedContextErrors(fieldsToContexts, mergedContexts),
    ...getGlobalContextsUsedInProjectErrors(contexts, projectNamesToContexts),
  ]
}
