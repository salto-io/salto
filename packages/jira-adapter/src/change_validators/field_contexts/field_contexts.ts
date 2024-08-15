/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isReferenceExpression,
  ReadOnlyElementsSource,
  ReferenceExpression,
  UnresolvedReference,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { getInstancesFromElementSource } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { PROJECT_CONTEXTS_FIELD } from '../../filters/fields/contexts_projects_filter'
import { PROJECT_TYPE } from '../../constants'
import { FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME } from '../../filters/fields/constants'
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
      if (!isReferenceExpression(ref) || ref.value instanceof UnresolvedReference) {
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
  if (
    !changes.find(change => [PROJECT_TYPE, FIELD_CONTEXT_TYPE_NAME].includes(getChangeData(change).elemID.typeName))
  ) {
    return []
  }

  const relevantInstances = _.groupBy(
    await getInstancesFromElementSource(elementSource, [PROJECT_TYPE, FIELD_CONTEXT_TYPE_NAME, FIELD_TYPE_NAME]),
    instance => instance.elemID.typeName,
  )

  const fieldsToContexts = Object.fromEntries(
    await awu((relevantInstances[FIELD_TYPE_NAME] ?? []).filter(field => field.value.contexts !== undefined))
      .map(async field => [field.elemID.getFullName(), await getFieldContexts(field, elementSource)])
      .toArray(),
  )
  const projectNamesToContexts: Record<string, Set<string>> = Object.fromEntries(
    (relevantInstances[PROJECT_TYPE] ?? [])
      .filter(project => project.value[PROJECT_CONTEXTS_FIELD] !== undefined)
      .map(project => [
        project.elemID.name,
        new Set(
          project.value[PROJECT_CONTEXTS_FIELD].filter((ref: ReferenceExpression) => {
            if (!isReferenceExpression(ref)) {
              log.warn(`Found a non reference expression in project ${project.elemID.getFullName()}`)
              return false
            }
            return true
          }).map((context: ReferenceExpression) => context.elemID.getFullName()),
        ),
      ]),
  )
  const mergedContexts = Object.values(projectNamesToContexts).reduce((acc, projectContexts) => {
    projectContexts.forEach(context => acc.add(context))
    return acc
  }, new Set<string>())

  const changesIds = new Set(changes.map(change => getChangeData(change).elemID.getFullName()))

  return [
    ...getUnreferencedContextErrors(fieldsToContexts, mergedContexts),
    ...getGlobalContextsUsedInProjectErrors(relevantInstances[FIELD_CONTEXT_TYPE_NAME] ?? [], projectNamesToContexts),
  ].filter(change => changesIds.has(change.elemID.getFullName()))
}
