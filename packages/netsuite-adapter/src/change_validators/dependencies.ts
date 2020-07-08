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
import {
  Change, ChangeError, getChangeElement, InstanceElement, isInstanceElement,
} from '@salto-io/adapter-api'
import { findDependingInstancesFromRefs } from '../adapter'

type ValidityStatus = 'valid' | 'invalid' | 'unknown'

export const validateDependsOnInvalidElement = (
  inputInvalidElementIds: string[],
  changes: ReadonlyArray<Change>,
): ReadonlyArray<ChangeError> => {
  const elemValidity = new Map<string, ValidityStatus>(
    inputInvalidElementIds.map(id => [id, 'invalid'])
  )

  const isInvalid = (instance: InstanceElement): boolean => {
    const status = elemValidity.get(instance.elemID.getFullName())
    if (status !== undefined) {
      return status === 'invalid'
    }
    // Mark validity unknown to avoid reference loops
    elemValidity.set(instance.elemID.getFullName(), 'unknown')
    const elemIsInvalid = findDependingInstancesFromRefs(instance).some(isInvalid)
    // Remember final validity decision to avoid checking this instance again
    elemValidity.set(instance.elemID.getFullName(), elemIsInvalid ? 'invalid' : 'valid')
    return elemIsInvalid
  }

  return changes
    .map(getChangeElement)
    .filter(isInstanceElement)
    .filter(instance => !inputInvalidElementIds.includes(instance.elemID.getFullName()))
    .filter(isInvalid)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Depends on an element that has errors',
      detailedMessage: `(${instance.elemID.getFullName()}) depends on an element that has errors`,
    }))
}
