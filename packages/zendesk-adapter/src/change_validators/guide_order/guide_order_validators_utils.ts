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
import {
  Change,
  ChangeDataType,
  ChangeError, getChangeData, InstanceElement, isAdditionChange,
  isAdditionOrModificationChange, isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'

export const isEverythingReferences = (orderInstance: ChangeDataType, orderField: string)
    : boolean =>
  isInstanceElement(orderInstance)
  // If the field doesn't exist we treat it as true
  && (orderInstance.value[orderField] === undefined
  || orderInstance.value[orderField].every(isReferenceExpression))

export const createNotReferencesError = (instance: ChangeDataType, orderField: string)
    : ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Guide elements order list includes an invalid Salto reference',
  detailedMessage: `One or more elements in ${instance.elemID.getFullName()}'s ${orderField} field are not a valid Salto reference`,
})

// Validates that all the elements in the categories order list are references
export const validateReferences = (
  changes: readonly Change[],
  orderField: string,
  orderTypeName: string
): ChangeError[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(instance => orderTypeName === instance.elemID.typeName)
    .filter(instance => !isEverythingReferences(instance, orderField))
    .flatMap(instance => [createNotReferencesError(instance, orderField)])

const createNoOrderInstanceWarning = (instance: InstanceElement, orderTypeName: string): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: `Instance element not specified in ${orderTypeName}`,
  detailedMessage: `Instance ${instance.elemID.name} of type '${instance.elemID.typeName}' is not listed in ${orderTypeName}, and will be added to be first by default. If order is important, please include it under the ${orderTypeName}`,
})

// Warns the user if he is adding a child instance and not its order instance
export const validateOrderElementAdded = (
  changes: readonly Change[],
  orderField: string,
  orderTypeName: string,
  childTypeName: string,
): ChangeError[] => {
  const relevantChildInstances = changes.filter(isInstanceChange).filter(isAdditionChange)
    .map(getChangeData).filter(child => child.elemID.typeName === childTypeName)

  const relevantOrderInstances = changes.filter(isInstanceChange).filter(isAdditionOrModificationChange)
    .map(getChangeData).filter(order => order.elemID.typeName === orderTypeName)

  return relevantChildInstances
    .filter(child => relevantOrderInstances.every(
      order => order.value[orderField] !== undefined // fields with a value of empty list are sometimes removed
          && !order.value[orderField].map((childRef: InstanceElement) => childRef.value.elemID).includes(child.elemID)
    ))
    .map(child => createNoOrderInstanceWarning(child, orderTypeName))
}
