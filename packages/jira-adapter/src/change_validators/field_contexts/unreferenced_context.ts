/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ElemID, ReferenceExpression } from '@salto-io/adapter-api'
import { values } from '@salto-io/lowerdash/'

const { isDefined } = values

const getUnreferencedContextError = (id: ElemID): ChangeError => ({
  elemID: id,
  severity: 'Error' as const,
  message: 'Non-global field context not referenced by any project.',
  detailedMessage:
    'This field context is not global and isn’t referenced by any project, and can’t be deployed. In order to deploy this context, either make it global, or include the Project which references it in your deployment. Learn more: https://help.salto.io/en/articles/6947372-non-global-field-context-not-referenced-by-any-project',
})

const getUnreferencedContextErrorWithOtherValidContexts = (id: ElemID): ChangeError => ({
  elemID: id,
  severity: 'Error' as const,
  message: 'Non-global field context not referenced by any project. There are other valid contexts.',
  detailedMessage:
    'This field context is not global and isn’t referenced by any project, and can’t be deployed. However, the field has other valid contexts, so it’s probably safe to continue without this context. Learn more: https://help.salto.io/en/articles/6947372-non-global-field-context-not-referenced-by-any-project',
})

export const getUnreferencedContextErrors = (
  fieldsToContexts: Record<string, ReferenceExpression[]>,
  projectContexts: Set<string>,
): ChangeError[] =>
  Object.entries(fieldsToContexts)
    .map(([_field, contexts]) => {
      const fieldContextsIds = contexts.filter(context => !context.value.isGlobalContext).map(context => context.elemID)
      const notFoundContexts = fieldContextsIds.filter(context => !projectContexts.has(context.getFullName()))
      if (notFoundContexts.length === 0) {
        return undefined
      }
      if (notFoundContexts.length !== contexts.length) {
        // Either one of the contexts is global, or there are other valid contexts
        return notFoundContexts.map(getUnreferencedContextErrorWithOtherValidContexts)
      }
      return notFoundContexts.map(getUnreferencedContextError)
    })
    .filter(isDefined)
    .flat()
