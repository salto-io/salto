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
import {
  ChangeValidator, getChangeData,
  isInstanceChange, isModificationChange,
} from '@salto-io/adapter-api'
import { detailedCompare } from '@salto-io/adapter-utils'
import { ACCOUNT_SETTING_TYPE_NAME } from '../filters/account_settings'

/**
 * TODOTODOTODO
 * @param changes
 */
export const featureActivationValidator: ChangeValidator = async changes => {
  const accountSettingsChange = changes
    .filter(isModificationChange)
    .filter(isInstanceChange)
    .find(change => getChangeData(change).elemID.typeName === ACCOUNT_SETTING_TYPE_NAME)

  if (accountSettingsChange === undefined) {
    return []
  }

  const activatedFeatures = detailedCompare(accountSettingsChange.data.before, accountSettingsChange.data.after)
    .filter(isModificationChange)
    .filter(detailedChange => detailedChange.id.getFullNameParts()[4] === 'active_features')
    .filter(detailedChange => detailedChange.data.before === false && detailedChange.data.after === true)
    .map(detailedChange => detailedChange.id.name)


  // TODO: talk to Tomer
  return activatedFeatures.length === 0 ? [] : [{
    elemID: accountSettingsChange.data.after.elemID,
    severity: 'Info',
    message: 'Features activated',
    detailedMessage: `The features ${activatedFeatures.join(', ')} were activated, this may cost moneeeey`,
  }]
}
