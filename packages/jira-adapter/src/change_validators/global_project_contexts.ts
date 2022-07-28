/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isAdditionChange, isAdditionOrModificationChange, isInstanceChange, isRemovalOrModificationChange, ReferenceExpression } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { PROJECT_CONTEXTS_FIELD } from '../filters/fields/contexts_projects_filter'
import { PROJECT_TYPE } from '../constants'
import { FIELD_CONTEXT_TYPE_NAME } from '../filters/fields/constants'

const { awu } = collections.asynciterable

export const globalProjectContextsValidator: ChangeValidator = async (changes, elementsSource) => {
  if (elementsSource === undefined) {
    return []
  }

  const ids = await awu(await elementsSource.list()).toArray()

  const projects = await awu(ids)
    .filter(id => id.typeName === PROJECT_TYPE)
    .filter(id => id.idType === 'instance')
    .map(id => elementsSource.get(id))
    .toArray()

  const contexts = await awu(ids)
    .filter(id => id.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(id => id.idType === 'instance')
    .map(id => elementsSource.get(id))
    .toArray()

  const projectContexts = new Set(projects
    .flatMap(proj => proj.value[PROJECT_CONTEXTS_FIELD] ?? [])
    .map(ref => ref.elemID.getFullName()))

  const [referencedContexts, nonReferencedContexts] = _.partition(
    contexts,
    context => projectContexts.has(context.elemID.getFullName())
  )

  const referencedContextErrors = referencedContexts
    .filter(context => context.value.isGlobalContext)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Global context cannot be used in individual projects',
      detailedMessage: `The context ${instance.elemID.getFullName()} is set as global context, and therefore cannot be referenced from individual projects.`,
    }))

  const idToChange = _.keyBy(changes, change => getChangeData(change).elemID.getFullName())

  const [nonReferencedNewContexts, nonReferencedExistingContexts] = _.partition(
    nonReferencedContexts,
    context => context.elemID.getFullName() in idToChange
      && isAdditionChange(idToChange[context.elemID.getFullName()])
  )

  const nonReferencedNewContextErrors = nonReferencedNewContexts
    .filter(context => !context.value.isGlobalContext)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error' as const,
      message: 'Field context is not used in any project',
      detailedMessage: `The context ${instance.elemID.getFullName()} is not used by any project and it is not a global context, so it cannot be created.`,
    }))

  const nonReferencedExistingContextErrors = changes
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
      detailedMessage: `A field context which is not global must be referenced by at least one project. The deployment of ${instance.elemID.getFullName()} will results the following contexts to have no references: ${removedContexts.map(context => context.elemID.getFullName()).join(', ')} and therefore the project cannot be deployed.
To solve this either modify the project to keep a reference to these contexts, or remove the contexts from the workspace`,
    }))


  return [
    ...nonReferencedNewContextErrors,
    ...nonReferencedExistingContextErrors,
    ...referencedContextErrors,
  ]
}
