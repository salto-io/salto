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
import { ChangeValidator, getChangeData, isInstanceChange, isModificationChange } from '@salto-io/adapter-api'
import { isInactiveCustomAppChange } from '../filters/app_deployment'
import { INACTIVE_STATUS, APPLICATION_TYPE_NAME } from '../constants'

/**
 * Modifications of custom application in status 'INACTIVE' are not supported via the Okta API
 * Therefore, we notify the user the application will be activated in order to apply changes
 */
export const customApplicationStatusValidator: ChangeValidator = async changes => {
  const relevantChanges = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(instance => getChangeData(instance).elemID.typeName === APPLICATION_TYPE_NAME)
    .filter(change => isInactiveCustomAppChange(change))

  return relevantChanges.map(change => ({
    elemID: getChangeData(change).elemID,
    severity: 'Warning',
    message: 'Application will be activated in order to apply those changes',
    detailedMessage: `Modifications of custom applications in status ${INACTIVE_STATUS} are not supported via the Okta API. Therefore, Salto will activate the application in order to apply changes, and deactivate it afterwards. Alternatively, you can make this change in Okta and fetch.`,
  }))
}
