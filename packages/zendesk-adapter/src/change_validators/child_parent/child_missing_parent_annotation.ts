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
import _ from 'lodash'
import { values, collections } from '@salto-io/lowerdash'
import { ChangeValidator, getChangeData, isInstanceChange,
  ChangeError, InstanceElement, ModificationChange, isAdditionOrModificationChange,
  isReferenceExpression, isInstanceElement, AdditionChange, ReferenceExpression,
  isAdditionChange } from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { ZendeskApiConfig } from '../../config'
import { getChildAndParentTypeNames } from './utils'

const createChildReferencesError = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  childFullName: string,
): ChangeError => {
  const instance = getChangeData(change)
  return {
    elemID: instance.elemID,
    severity: 'Error',
    message: 'Cannot add or modify elements without updating references to them from their children',
    detailedMessage: `This element must be referenced by its child ‘${childFullName}‘`,
  }
}

const validateChildParentAnnotation = (
  parentChange: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  childRef: ReferenceExpression,
  validChildType: string,
): ChangeError | undefined => {
  const parentInstance = getChangeData(parentChange)
  const childInstance = childRef.value
  const childFullName = childInstance.elemID.getFullName()
  try {
    if (!(
      childInstance.elemID.typeName === validChildType
      && getParent(childInstance).elemID.isEqual(parentInstance.elemID)
    )) {
      return createChildReferencesError(parentChange, childFullName)
    }
  } catch (e) {
    return createChildReferencesError(parentChange, childFullName)
  }
  return undefined
}

const hasRelevantFieldChanged = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>,
  fieldName: string,
): boolean => {
  if (isAdditionChange(change)) {
    return change.data.after.value[fieldName] !== undefined
  }
  return !_.isEqual(change.data.before.value[fieldName], change.data.after.value[fieldName])
}

/**
 * Creates an error when a child value being added or modified in the parent (reference expression)
 * and the parent annotation in the child instance isn't updated
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
    const relationship = relationships.find(r => r.parent === instance.elemID.typeName)
    if (relationship === undefined || !hasRelevantFieldChanged(change, relationship.fieldName)) {
      return []
    }
    // Handling with list-type fields as well
    const { makeArray } = collections.array
    const fieldValue = makeArray(instance.value[relationship.fieldName])
    return fieldValue
      .filter(value => isReferenceExpression(value) && isInstanceElement(value.value))
      .map(childRef => validateChildParentAnnotation(
        change,
        childRef,
        relationship.child
      ))
      .filter(values.isDefined)
  })
}
