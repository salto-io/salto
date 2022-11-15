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
  ChangeError, getChangeData,
  isAdditionOrModificationChange,
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
  message: `${orderField} field error`,
  detailedMessage: `Some ${orderField} elements are not a reference`,
})

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
