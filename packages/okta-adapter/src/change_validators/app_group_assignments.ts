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
import { logger } from '@salto-io/logging'
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  isAdditionOrModificationChange,
  InstanceElement,
} from '@salto-io/adapter-api'
import { getParent } from '@salto-io/adapter-utils'
import { ACTIVE_STATUS, APPLICATION_TYPE_NAME, APP_GROUP_ASSIGNMENT_TYPE_NAME, INACTIVE_STATUS } from '../constants'

const log = logger(module)

const isParentAppInStatusInactive = (appGroupInstance: InstanceElement): boolean => {
  try {
    const parent = getParent(appGroupInstance)
    return parent.elemID.typeName === APPLICATION_TYPE_NAME && parent.value.status === INACTIVE_STATUS
  } catch (err) {
    log.error(
      'Failed to get parent app, skipping appGroupAssignmentValidator for %s',
      appGroupInstance.elemID.getFullName(),
    )
    return false
  }
}

/**
 * Okta does not support adding to modifying group assignment for applications in status inactive.
 */
export const appGroupAssignmentValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .filter(isAdditionOrModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === APP_GROUP_ASSIGNMENT_TYPE_NAME)
    .map(getChangeData)
    .filter(isParentAppInStatusInactive)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: `Cannot edit group assignments for application in status ${INACTIVE_STATUS}`,
      detailedMessage: `Group assignments cannot be changed for applications in status ${INACTIVE_STATUS}. In order to apply this change, modify application status to be ${ACTIVE_STATUS}.`,
    }))
