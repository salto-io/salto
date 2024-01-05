/*
*                      Copyright 2024 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, isInstanceChange, isAdditionOrModificationChange, InstanceElement, AdditionChange, isAdditionChange, ModificationChange, ReferenceExpression } from '@salto-io/adapter-api'
import { references } from '@salto-io/adapter-utils'
import { ACTIVE_STATUS, APPLICATION_TYPE_NAME, INACTIVE_STATUS } from '../constants'

const { isArrayOfRefExprToInstances } = references

const isArrayOfReferencesOrUndefined = (value: unknown): value is ReferenceExpression[] | undefined =>
  value === undefined || isArrayOfRefExprToInstances(value)

const isGroupAssignmentChange = (
  change: AdditionChange<InstanceElement> | ModificationChange<InstanceElement>
): boolean => {
  if (isAdditionChange(change)) {
    return !_.isEmpty(getChangeData(change).value.assignedGroups)
  }
  // ModificationChange
  const { before: { value: beforeValue }, after: { value: afterValue } } = change.data
  const [beforeAssignments, afterAssignments] = [beforeValue.assignedGroups, afterValue.assignedGroups]
  if (!isArrayOfReferencesOrUndefined(beforeAssignments) || !isArrayOfReferencesOrUndefined(afterAssignments)) {
    return false
  }
  return !_.isEqual(
    beforeAssignments?.map(ref => ref.elemID.getFullName()),
    afterAssignments?.map(ref => ref.elemID.getFullName())
  )
}

/**
 * Okta does not support group assignment for applicatons in status inactive.
 */
export const appGroupAssignmentValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === APPLICATION_TYPE_NAME)
    .filter(change => getChangeData(change).value.status === INACTIVE_STATUS)
    .filter(isGroupAssignmentChange)
    .map(change => ({
      elemID: getChangeData(change).elemID,
      severity: 'Error',
      message: `Cannot edit group assignments for application in status ${INACTIVE_STATUS}`,
      detailedMessage: `Group assignments cannot be changed for applications in status ${INACTIVE_STATUS}. In order to apply this change, modify application status to be ${ACTIVE_STATUS}.`,
    }))
)
