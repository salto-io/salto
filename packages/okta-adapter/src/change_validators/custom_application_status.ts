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
import { ChangeValidator, getChangeData, isInstanceChange, InstanceElement, isModificationChange, ModificationChange } from '@salto-io/adapter-api'
import { INACTIVE_STATUS, APPLICATION_TYPE_NAME } from '../constants'

const isDeactivatedCustomAppChange = (change: ModificationChange<InstanceElement>): boolean =>
  change.data.before.value.status === INACTIVE_STATUS
    && change.data.after.value.status === INACTIVE_STATUS
    // customName field only exist in custom applications
    && getChangeData(change).value.customName !== undefined

/**
 * Modification of custom application in status 'INACTIVE' is not supported via the Okta API
 */
export const customApplicationStatusValidator: ChangeValidator = async changes => {
  const relevantChanges = changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(instance => getChangeData(instance).elemID.typeName === APPLICATION_TYPE_NAME)
    .filter(change => isDeactivatedCustomAppChange(change))

  return relevantChanges.map(change => ({
    elemID: getChangeData(change).elemID,
    severity: 'Error',
    message: `Cannot change custom application in status ${INACTIVE_STATUS}`,
    detailedMessage: `Modifications of custom applications in status ${INACTIVE_STATUS} is not supported via the Okta API. Please make this change in Okta and fetch, or activate the application and try again.`,
  }))
}
