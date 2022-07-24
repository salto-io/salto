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
import _ from 'lodash'
import { ChangeValidator, getChangeData, isInstanceChange,
  ChangeError, InstanceElement, ModificationChange, isAdditionOrModificationChange, isReferenceExpression, isInstanceElement, AdditionChange, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { ZendeskApiConfig } from '../../config'
import { getChildAndParentTypeNames } from './utils'

export const createChildReferencesError = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  childFullName: string,
): ChangeError => {
  const instance = getChangeData(change)
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: `Can not add/modify ${instance.elemID.typeName} as long the child instance isn't updated`,
    detailedMessage: `Can not add/modify ${instance.elemID.getFullName()} because it's not the parent in the insatnce ${childFullName}`,
  }
}

/*
When a child value being added or modified in the parent (reference expression)
and the parent annotation in the child instance isn't updated
*/
export const childMissingParentAnnotationValidatorCreator = (
  apiConfig: ZendeskApiConfig,
): ChangeValidator => async changes => {
  const relationships = getChildAndParentTypeNames(apiConfig)
  const parentTypes = new Set(relationships.map(r => r.parent))

  const relevantParentChanges = changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => parentTypes.has(getChangeData(change).elemID.typeName))

  return relevantParentChanges.flatMap(change => {
    const instance = getChangeData(change)
    const { fieldName: relevantFieldName, child: childType } = relationships.find(
      r => r.parent === instance.elemID.typeName
    ) ?? {}
    if (relevantFieldName === undefined) {
      return []
    }
    // TODO: support lists fields
    const childRef = _.isArray(instance.value[relevantFieldName])
      ? instance.value[relevantFieldName]?.[0]
      : instance.value[relevantFieldName]
    if (!(isReferenceExpression(childRef) && isInstanceElement(childRef.value))) {
      return []
    }
    const childInstance = childRef.value
    const childFullName = childInstance.elemID.getFullName()
    if (!(
      childInstance.elemID.typeName === childType
      && childInstance.annotations[CORE_ANNOTATIONS.PARENT]?.[0].value.elemID.getFullName()
        === instance.elemID.getFullName())) {
      return [createChildReferencesError(change, childFullName)]
    }
    return []
  })
}
