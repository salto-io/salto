/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  Change,
  ChangeError,
  ChangeValidator,
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isRemovalOrModificationChange,
  ReferenceExpression,
  SeverityLevel,
} from '@salto-io/adapter-api'
import { getInstancesFromElementSource, getParent, getParents } from '@salto-io/adapter-utils'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { PROJECT_TYPE } from '../../constants'

const { awu } = collections.asynciterable
const log = logger(module)

const createFieldContextErrorMessage = (elemID: ElemID, fieldName: string): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'A field can only have a single global context',
  detailedMessage: `Can't deploy this global context because the deployment will result in more than a single global context for field ${fieldName}.`,
})
const createProjectErrorMessage = (elemID: ElemID, fieldContextName: string): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'A field can only have a single global context',
  detailedMessage: `Can't remove the field context ${fieldContextName} from this project as it will result in more than a single global context.`,
})

const getParentElemID = (instance: InstanceElement): ElemID => {
  const parent = getParents(instance)[0]
  if (!isReferenceExpression(parent)) {
    throw new Error(`Expected ${instance.elemID.getFullName()} parent to be a reference expression`)
  }
  return parent.elemID
}

type ProjectChangesData = {
  changes: Change<InstanceElement>[]
  fieldElemId: ElemID
  fieldContextName: string
}

export const fieldSecondGlobalContextValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run fieldSecondGlobalContextValidator because element source is undefined')
    return []
  }
  const fieldToGlobalContextCount: Record<string, number> = {}
  const fieldToImplicitGlobalContextCount: Record<string, number> = {}
  const fillFieldToGlobalContextCount = async (): Promise<void> =>
    awu(await elementSource.getAll())
      .filter(elem => elem.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
      .filter(isInstanceElement)
      .filter(instance => instance.value.isGlobalContext)
      .forEach(async instance => {
        const fieldElemId = getParentElemID(instance)
        const fieldName = fieldElemId.getFullName()
        if (fieldToGlobalContextCount[fieldName] === undefined) {
          fieldToGlobalContextCount[fieldName] = 1
        } else {
          fieldToGlobalContextCount[fieldName] += 1
        }
      })
  const fillFieldContextToProjectChangeData = async (): Promise<Map<string, ProjectChangesData>> => {
    const fieldContextToProjectChangeData = new Map<string, ProjectChangesData>()
    await awu(changes)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === PROJECT_TYPE)
      .filter(isRemovalOrModificationChange)
      .forEach(async change => {
        await awu(change.data.before.value.fieldContexts ?? [])
          .filter(isReferenceExpression)
          .forEach(async (context: ReferenceExpression) => {
            if (fieldContextToProjectChangeData.get(context.elemID.getFullName()) === undefined) {
              const fieldElemId = getParentElemID(await context.getResolvedValue(elementSource))
              fieldContextToProjectChangeData.set(context.elemID.getFullName(), {
                fieldElemId,
                fieldContextName: context.elemID.name,
                changes: [],
              })
            }
            fieldContextToProjectChangeData.get(context.elemID.getFullName())?.changes.push(change)
          })
      })
    if (fieldContextToProjectChangeData.size === 0) {
      return fieldContextToProjectChangeData
    }
    const projectInstances = await getInstancesFromElementSource(elementSource, [PROJECT_TYPE])
    // if there is a project that using a field context that is not global context
    projectInstances
      .flatMap(instance => instance.value.fieldContexts)
      .filter(isReferenceExpression)
      .forEach((context: ReferenceExpression) => {
        fieldContextToProjectChangeData.delete(context.elemID.getFullName())
      })
    return fieldContextToProjectChangeData
  }

  const globalContextList = await awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(instance => instance.value.isGlobalContext)
    .toArray()
  const globalContextElemIdsSet = new Set(globalContextList.map(instance => instance.elemID.getFullName()))

  await fillFieldToGlobalContextCount()
  const fieldContextToProjectChangesData = await fillFieldContextToProjectChangeData()

  Array.from(fieldContextToProjectChangesData)
    .filter(([fieldContextName]) => !globalContextElemIdsSet.has(fieldContextName))
    .forEach(([, { fieldElemId }]) => {
      const fieldFullName = fieldElemId.getFullName()
      if (fieldToImplicitGlobalContextCount[fieldFullName] === undefined) {
        fieldToImplicitGlobalContextCount[fieldFullName] = 1
      } else {
        fieldToImplicitGlobalContextCount[fieldFullName] += 1
      }
    })

  const errorMessages = Array.from(fieldContextToProjectChangesData.entries())
    .filter(([fieldContextName]) => !globalContextElemIdsSet.has(fieldContextName))
    .filter(([, { fieldElemId }]) => {
      const fieldFullName = fieldElemId.getFullName()
      const newGlobalContextsCount = fieldToImplicitGlobalContextCount[fieldFullName]
      if (newGlobalContextsCount > 1 || (newGlobalContextsCount > 0 && fieldToGlobalContextCount[fieldFullName] >= 1)) {
        return true
      }
      return false
    })
    .flatMap(([, { changes: projectChanges, fieldContextName }]) =>
      projectChanges.map(change => createProjectErrorMessage(getChangeData(change).elemID, fieldContextName)),
    )

  if (globalContextList.length > 0) {
    const secondGlobalContextErrorMessages = globalContextList
      .map(instance => ({ context: instance, field: getParent(instance) }))
      .map(contextAndField => {
        if (fieldToGlobalContextCount[contextAndField.field.elemID.getFullName()] > 1) {
          const fieldName =
            contextAndField.field.annotations[CORE_ANNOTATIONS.ALIAS] !== undefined
              ? contextAndField.field.annotations[CORE_ANNOTATIONS.ALIAS]
              : contextAndField.field.elemID.getFullName()
          return createFieldContextErrorMessage(contextAndField.context.elemID, fieldName)
        }
        return undefined
      })
      .filter(values.isDefined)
    errorMessages.push(...secondGlobalContextErrorMessages)
  }
  return errorMessages
}
