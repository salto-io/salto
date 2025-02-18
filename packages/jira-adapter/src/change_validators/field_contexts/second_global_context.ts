/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  ElemID,
  getChangeData,
  isAdditionChange,
  isAdditionOrModificationChange,
  isInstanceChange,
  isReferenceExpression,
  ReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { getElementPrettyName, getInstancesFromElementSource, getParentElemID } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { isGlobalContext } from '../../common/fields'
import { AddOrModifyInstanceChange } from '../../common/general'

const log = logger(module)

const createSecondGlobalContextErrorMessage = (elemID: ElemID, fieldName: string): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'A field can only have a single global context',
  detailedMessage: `Can't deploy this global context because the deployment will result in more than a single global context for field ${fieldName}.`,
})

const createProjectScopeErrorMessage = (elemID: ElemID, fieldName: string, projectName: string): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'A field can only have a single context per project',
  detailedMessage: `Can't deploy this project scoped context because the deployment will result in more than one context for field ${fieldName} with a scope for project ${projectName}`,
})

export const fieldSecondContextValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run fieldSecondContextValidator because element source is undefined')
    return []
  }

  const contextChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === FIELD_CONTEXT_TYPE_NAME)

  if (contextChanges.length === 0) {
    return []
  }

  const contextsByFieldName = _.groupBy(
    await getInstancesFromElementSource(elementSource, [FIELD_CONTEXT_TYPE_NAME]),
    instance => getParentElemID(instance).getFullName(),
  )

  const globalContextCountByFieldName = _.mapValues(
    contextsByFieldName,
    instances => instances.filter(isGlobalContext).length,
  )
  const contextCountByFieldNameAndProject = _.mapValues(contextsByFieldName, instances =>
    _.chain(instances)
      .flatMap(context => (context.value.projectIds ? context.value.projectIds : []))
      .filter(isReferenceExpression)
      .map(projectReference => projectReference.elemID.getFullName())
      .countBy()
      .value(),
  )

  const addedGlobalContext = (change: AddOrModifyInstanceChange): boolean =>
    isGlobalContext(change.data.after) && (isAdditionChange(change) || !isGlobalContext(change.data.before))

  const secondGlobalErrors = Promise.all(
    contextChanges
      .filter(addedGlobalContext)
      .map(getChangeData)
      .filter(instance => globalContextCountByFieldName[getParentElemID(instance).getFullName()] > 1)
      .map(async instance =>
        createSecondGlobalContextErrorMessage(
          instance.elemID,
          getElementPrettyName(await elementSource.get(getParentElemID(instance))),
        ),
      ),
  )

  const secondProjectErrors = Promise.all(
    contextChanges
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.value.projectIds && instance.value.projectIds.length > 0)
      .map(instance => ({
        instance,
        secondProjectScopes: instance.value.projectIds
          .filter(isReferenceExpression)
          .map((projectReference: ReferenceExpression) => projectReference.elemID.getFullName())
          .filter(
            (projectName: string) =>
              contextCountByFieldNameAndProject[getParentElemID(instance).getFullName()][projectName] > 1,
          ),
      }))
      .filter(({ secondProjectScopes }) => secondProjectScopes.length > 0)
      .map(async ({ instance, secondProjectScopes }) => {
        const fieldName = getElementPrettyName(await elementSource.get(getParentElemID(instance)))
        return secondProjectScopes.map((projectFullName: string) =>
          createProjectScopeErrorMessage(instance.elemID, fieldName, projectFullName),
        )
      }),
  )

  return Promise.all([secondGlobalErrors, secondProjectErrors]).then(([globalErrors, projectErrors]) => [
    ...globalErrors,
    ...projectErrors.flat(),
  ])
}
