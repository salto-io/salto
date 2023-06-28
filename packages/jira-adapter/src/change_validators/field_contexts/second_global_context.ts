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
import { ChangeValidator, getChangeData, isAdditionOrModificationChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { FIELD_CONTEXT_TYPE_NAME } from '../../filters/fields/constants'
import { getFieldContexts } from './field_contexts'


const { awu } = collections.asynciterable

export const fieldSecondGlobalContextValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    return []
  }
  const fieldToGlobalContextsCount: Record<string, number> = {}
  await awu(changes).filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .filter(instance => instance.value.isGlobalContext)
    .map(instance => ({ context: instance, field: getParent(instance) }))
    .forEach(instanceAndField => {
      const key = instanceAndField.field.elemID.getFullName()
      if (fieldToGlobalContextsCount[key] === undefined) {
        fieldToGlobalContextsCount[key] = 1
      } else {
        fieldToGlobalContextsCount[instanceAndField.field.elemID.getFullName()] += 1
      }
    })

  return awu(changes)
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === FIELD_CONTEXT_TYPE_NAME)
    .map(instance => ({ context: instance, field: getParent(instance) }))
    .filter(async contextAndField => {
      const globalContexts = (await getFieldContexts(contextAndField.field, elementSource))
        .filter(context => context.value.isGlobalContext)
      const isNewContextIncluded = globalContexts
        .filter(instance => instance.elemID === contextAndField.context.elemID)
        .length === 0
      const isTwoGlobalContextAdditions = fieldToGlobalContextsCount[contextAndField.field.elemID.getFullName()] > 1
      return isTwoGlobalContextAdditions
        || globalContexts.length > 1
        || (globalContexts.length === 1 && isNewContextIncluded)
    })
    .map(async contextAndField => ({
      elemID: contextAndField.context.elemID,
      severity: 'Error' as SeverityLevel,
      message: 'Can\'t deploy global field context that will be the second global context',
      detailedMessage: `Can't deploy global field context ${contextAndField.context.elemID.getFullName()} because the field ${contextAndField.field.elemID.getFullName()} already has a global context.`,
    }))
    .toArray()
}
