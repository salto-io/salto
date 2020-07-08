/*
*                      Copyright 2020 Salto Labs Ltd.
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
import {
  Change, ChangeError, ElemID, getChangeElement, InstanceElement, isInstanceElement,
} from '@salto-io/adapter-api'
import { getAllDependingInstances } from '../adapter'

export const validateDependsOnInvalidElement = (elemIdsWithValidation: string[],
  changes: ReadonlyArray<Change>): ReadonlyArray<ChangeError> => {
  const invalidElementIds = new Set<string>(elemIdsWithValidation)
  const validElementIds = new Set<string>()

  const createShouldProceedFunc = (changedInstance: InstanceElement):
    ((instance: InstanceElement) => boolean) =>
    (instance: InstanceElement) => {
      if (invalidElementIds.has(instance.elemID.getFullName())) {
        invalidElementIds.add(instance.elemID.getFullName())
        invalidElementIds.add(changedInstance.elemID.getFullName())
        return false
      }
      return !validElementIds.has(instance.elemID.getFullName())
    }

  if (invalidElementIds.size === 0) {
    return []
  }
  changes
    .map(getChangeElement)
    .filter(isInstanceElement)
    .forEach(changedInstance => {
      const allDependingInstances = getAllDependingInstances(changedInstance, new Set(),
        createShouldProceedFunc(changedInstance))
      if (!invalidElementIds.has(changedInstance.elemID.getFullName())) {
        allDependingInstances.forEach(inst => validElementIds.add(inst.elemID.getFullName()))
      }
    })

  return _.without(Array.from(invalidElementIds), ...elemIdsWithValidation)
    .map(elemIdFullName => ({
      elemID: ElemID.fromFullName(elemIdFullName),
      severity: 'Error',
      message: 'Depends on an element that has errors',
      detailedMessage: `(${elemIdFullName}) depends on an element that has errors`,
    }))
}
