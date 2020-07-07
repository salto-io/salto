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
  Change, ChangeError, getChangeElement, InstanceElement, isInstanceElement,
} from '@salto-io/adapter-api'
import { findDependingInstancesFromRefs } from '../adapter'

export const validateDependsOnInvalidElement = (invalidElementIds: Set<string>,
  changes: ReadonlyArray<Change>): ReadonlyArray<ChangeError> => {
  const visitedElementIds = new Set<string>()

  const isValidInstance = (instance: InstanceElement): boolean => {
    if (invalidElementIds.has(instance.elemID.getFullName())) {
      return false
    }
    if (visitedElementIds.has(instance.elemID.getFullName())) {
      return true
    }
    visitedElementIds.add(instance.elemID.getFullName())
    const dependingInstances = findDependingInstancesFromRefs(instance)
    const invalidDependingInstances = dependingInstances
      .filter(dependingInstance => !isValidInstance(dependingInstance))
    if (!_.isEmpty(invalidDependingInstances)) {
      invalidElementIds.add(instance.elemID.getFullName())
      return false
    }
    return true
  }

  if (invalidElementIds.size === 0) {
    return []
  }
  const possiblyValidInstances = changes
    .map(getChangeElement)
    .filter(isInstanceElement)
    .filter(changedInstance => !invalidElementIds.has(changedInstance.elemID.getFullName()))
  return possiblyValidInstances
    .filter(changeInstance => !isValidInstance(changeInstance))
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: 'Depends on an element that has errors',
      detailedMessage: `(${elemID.getFullName()}) depends on an element that has errors`,
    }))
}
