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
import { ChangeError, ChangeValidator, CORE_ANNOTATIONS, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, isInstanceElement, isModificationChange, isReferenceExpression, ModificationChange, ReadOnlyElementsSource, ReferenceExpression, SeverityLevel } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { PROJECT_TYPE } from '../../constants'


const { awu } = collections.asynciterable
const log = logger(module)

const createErrorMessage = (elemID: ElemID, fieldName?: string): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'A field can only have a single global context',
  detailedMessage: elemID.typeName === PROJECT_TYPE
    ? 'Can\'t remove this context from this project as it will result in more than a single global context'
    : `Can't deploy this global context because the deployment will result in more than a single global context for field ${fieldName}.`,
})

const getParentWithElementSource = async (instance: InstanceElement, elementSource: ReadOnlyElementsSource)
: Promise<InstanceElement> => {
  const parent = instance.annotations[CORE_ANNOTATIONS.PARENT][0]
  if (!isReferenceExpression(parent)) {
    throw new Error(`Expected ${instance.elemID.getFullName()} parent to be a reference expression`)
  }
  const field = await parent.getResolvedValue(elementSource)
  if (!isInstanceElement(field)) {
    throw new Error(`Expected ${instance.elemID.getFullName()} parent to be an instance`)
  }
  return field
}

export const fieldSecondGlobalContextValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run fieldSecondGlobalContextValidator because element source is undefined')
    return []
  }
  const fieldToGlobalContextCount: Record<string, number> = {}
  const fillFieldToGlobalContextCount = async (): Promise<void> => (
    awu(await elementSource.getAll())
      .filter(elem => elem.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(isInstanceElement)
      .filter(instance => instance.value.isGlobalContext)
      .forEach(async instance => {
        const field = await getParentWithElementSource(instance, elementSource)
        const fieldName = field.elemID.getFullName()
        if (fieldToGlobalContextCount[fieldName] === undefined) {
          fieldToGlobalContextCount[fieldName] = 1
        } else {
          fieldToGlobalContextCount[fieldName] += 1
        }
      })
  )
  const globalContextList = await awu(changes).filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(instance => instance.value.isGlobalContext)
    .toArray()
  await fillFieldToGlobalContextCount()
  const isInvalidProjectFieldContextsModification = async (change: ModificationChange<InstanceElement>)
    : Promise<boolean> => {
    const afterContexts = new Set((change.data.after.value.fieldContexts ?? [])
      .map((context: ReferenceExpression) => context.elemID.getFullName()))
    const removedContexts = change.data.before.value.fieldContexts
      .filter((context: ReferenceExpression) => !afterContexts.has(context.elemID.getFullName()))
    const removedContextsFields = await Promise.all(removedContexts.map(async (context: ReferenceExpression) => (
      getParentWithElementSource(await context.getResolvedValue(), elementSource)
    )))
    // removing fieldContext from a project implicitly makes it global
    const fieldsWithSecondGlobalContext = removedContextsFields.filter(isInstanceElement)
      .filter((fieldInstance: InstanceElement) => fieldToGlobalContextCount[fieldInstance.elemID.getFullName()] === 1)
    return fieldsWithSecondGlobalContext.length > 0
  }

  const invalidProjectFieldContextsModification = await awu(changes).filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => change.data.after.elemID.typeName === PROJECT_TYPE)
    .filter(isInvalidProjectFieldContextsModification)
    .toArray()

  const errorMessages = [...invalidProjectFieldContextsModification
    .map(change => createErrorMessage(change.data.after.elemID))]
  if (globalContextList.length > 0) {
    const secondGlobalContextErrorMessages = globalContextList
      .map(instance => ({ context: instance, field: getParent(instance) }))
      .map(contextAndField => {
        if (fieldToGlobalContextCount[contextAndField.field.elemID.getFullName()] > 1) {
          const fieldName = contextAndField.field.annotations[CORE_ANNOTATIONS.ALIAS] !== undefined
            ? contextAndField.field.annotations[CORE_ANNOTATIONS.ALIAS]
            : contextAndField.field.elemID.getFullName()
          return createErrorMessage(contextAndField.context.elemID, fieldName)
        }
        return undefined
      })
      .filter(values.isDefined)
    errorMessages.push(...secondGlobalContextErrorMessages)
  }
  return errorMessages
}
