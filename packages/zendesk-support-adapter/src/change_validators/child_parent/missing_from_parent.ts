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
import { ChangeValidator, CORE_ANNOTATIONS, getChangeData, InstanceElement, isInstanceElement,
  isReferenceExpression, isInstanceChange, isModificationChange, AdditionChange, ChangeError,
  isAdditionChange } from '@salto-io/adapter-api'
import { ZendeskApiConfig } from '../../config'
import { getChildAndParentTypeNames, getRemovedAndAddedChildren } from './utils'

export const createParentReferencesError = (
  change: AdditionChange<InstanceElement>,
  parentFullName: string,
): ChangeError => {
  const instance = getChangeData(change)
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: `Can not add ${instance.elemID.typeName} because the reference to it from the parent is not exist`,
    detailedMessage: `Can not add ${instance.elemID.getFullName()} because the reference to it from ${parentFullName} is $not exist`,
  }
}

export const missingFromParentValidatorCreator = (
  apiConfig: ZendeskApiConfig,
): ChangeValidator => async changes => {
  const relationships = getChildAndParentTypeNames(apiConfig)
  const childrenTypes = new Set(relationships.map(r => r.child))
  const instanceChanges = changes.filter(isInstanceChange)
  const relevantChanges = instanceChanges
    .filter(
      change =>
        childrenTypes.has(getChangeData(change).elemID.typeName) && isAdditionChange(change)
    ) as AdditionChange<InstanceElement>[]
  const changeByID = Object.fromEntries(
    instanceChanges.map(change => [getChangeData(change).elemID.getFullName(), change])
  )
  return relevantChanges.flatMap(change => {
    const instance = getChangeData(change)
    const { typeName } = instance.elemID
    const parentRef = instance.annotations[CORE_ANNOTATIONS.PARENT]?.[0]
    if (!(isReferenceExpression(parentRef) && isInstanceElement(parentRef.value))) {
      return []
    }
    const parentFullName = parentRef.value.elemID.getFullName()
    const relevantRelations = relationships.filter(r => r.child === typeName)
    return relevantRelations.flatMap(relation => {
      const parentChange = changeByID[parentFullName]
      if ((parentChange === undefined) || !isModificationChange(parentChange)) {
        return [createParentReferencesError(change, parentFullName)]
      }
      const { added } = getRemovedAndAddedChildren(parentChange, relation.fieldName)
      if (isAdditionChange(change) && !added.includes(instance.elemID.getFullName())) {
        return [createParentReferencesError(change, parentFullName)]
      }
      return []
    })
  })
}
