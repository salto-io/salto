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
import { ChangeError, InstanceElement, isReferenceExpression, ElemID } from '@salto-io/adapter-api'
import { isDefined } from '@salto-io/lowerdash/src/values'

export const getUnreferencedContextErrors = (
  contexts: InstanceElement[],
  fieldsToContexts: Record<string, ElemID[]>,
  projectContexts: Set<string>,
): ChangeError[] =>
  Object.entries(fieldsToContexts).map(([_field, fieldContexts]) => {
    const fieldContextsIds = contexts
      .filter(context => isReferenceExpression(context))
      .map(context => context.elemID)
    const notFoundContexts = fieldContextsIds.filter(context => !projectContexts.has(context.getFullName()))
    if (notFoundContexts.length === 0) {
      return undefined
    }
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
  }).filter(isDefined).flat()
