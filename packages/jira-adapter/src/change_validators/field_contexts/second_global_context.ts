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
import { ChangeError, ChangeValidator, CORE_ANNOTATIONS, ElemID, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { getFieldContexts } from './field_contexts'


const { awu } = collections.asynciterable
const log = logger(module)

type ContextData = {
  isNeedToProduceError: boolean
  elemId: ElemID
}

const createErrorMessage = (elemID: ElemID, fieldName: string): ChangeError => ({
  elemID,
  severity: 'Error' as SeverityLevel,
  message: 'A field can only have a single global context',
  detailedMessage: `Can't deploy this global context because the deployment will result in more than a single global context for field ${fieldName}.`,
})

export const fieldSecondGlobalContextValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.error('Failed to run fieldSecondGlobalContextValidator because element source is undefined')
    return []
  }
  const resultErrors: ChangeError[] = []
  const fieldToGlobalContexts: Record<string, Record<string, ContextData>> = {}
  const validateSecondGlobalContest = async (
    {
      field,
      context,
    } :
    {
      field: InstanceElement
      context: InstanceElement
    }
  ): Promise<void> => {
    const fieldId = field.elemID.getFullName()
    const fieldName = field.annotations[CORE_ANNOTATIONS.ALIAS] !== undefined
      ? field.annotations[CORE_ANNOTATIONS.ALIAS]
      : field.elemID.getFullName()
    const contextId = context.elemID.getFullName()
    if (fieldToGlobalContexts[fieldId] === undefined) {
      const contextData: Record<string, ContextData> = {}
      contextData[contextId] = {
        isNeedToProduceError: true,
        elemId: context.elemID,
      }
      fieldToGlobalContexts[fieldId] = contextData
      const globalContexts = (await getFieldContexts(field, elementSource))
        .filter(fieldContext => fieldContext.value.isGlobalContext)
      globalContexts.forEach(contextOnField => {
        const currentContextId = contextOnField.elemID.getFullName()
        if (fieldToGlobalContexts[fieldId][currentContextId] === undefined) {
          // which means there is a second global context
          resultErrors.push(createErrorMessage(fieldToGlobalContexts[fieldId][contextId].elemId, fieldName))
          fieldToGlobalContexts[fieldId][contextId].isNeedToProduceError = false
        }
      })
    } else {
      // which means there is a second global context
      fieldToGlobalContexts[fieldId][contextId] = {
        isNeedToProduceError: true,
        elemId: context.elemID,
      }
      Object.keys(fieldToGlobalContexts[fieldId])
        .filter(currentContextId => fieldToGlobalContexts[fieldId][currentContextId].isNeedToProduceError)
        .forEach(currentContextId => {
          resultErrors.push(createErrorMessage(fieldToGlobalContexts[fieldId][currentContextId].elemId, fieldName))
          // mark it with false so we won't raise another error because of it
          fieldToGlobalContexts[fieldId][currentContextId].isNeedToProduceError = false
        })
    }
  }

  await awu(changes).filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(instance => instance.value.isGlobalContext)
    .map(instance => ({ context: instance, field: getParent(instance) }))
    .forEach(validateSecondGlobalContest)
  return resultErrors
}
