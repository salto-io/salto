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
import { ChangeValidator, getChangeData, InstanceElement,
  isInstanceChange, isModificationChange, Value } from '@salto-io/adapter-api'
import { ACCOUNT_SETTING_TYPE_NAME } from '../filters/account_settings'

const getTagField = (instance: InstanceElement): Value | undefined =>
  instance.value.routing?.autorouting_tag

export const accountSettingsValidator: ChangeValidator = async changes => (
  changes
    .filter(isInstanceChange)
    .filter(isModificationChange)
    .filter(change => getChangeData(change).elemID.typeName === ACCOUNT_SETTING_TYPE_NAME)
    .flatMap(change => {
      if (
        (getTagField(change.data.before) !== getTagField(change.data.after))
        && getTagField(change.data.after) === ''
      ) {
        return [{
          elemID: getChangeData(change).elemID,
          severity: 'Error',
          message: 'Cannot change an auto-routing tag to an empty value',
          detailedMessage: 'routing.autorouting_tag cannot be empty',
        }]
      }
      return []
    })
)
