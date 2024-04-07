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
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { VIEW_TYPE_NAME } from '../constants'
import { getAccountSettings, AccountSettingsInstance } from './utils'

const log = logger(module)

export const viewCustomStatusConditionsValidator: ChangeValidator = async (changes, elementSource) => {
  let accountSettings: AccountSettingsInstance
  try {
    accountSettings = await getAccountSettings(elementSource)
  } catch (e) {
    log.error(`Failed to run viewCustomStatusConditionsValidator: ${e.message}`)
    return []
  }

  if (accountSettings.value.tickets.custom_statuses_enabled === true) {
    return []
  }

  return changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(instance => instance.elemID.typeName === VIEW_TYPE_NAME)
    .filter(instance =>
      _.concat(instance.value?.conditions?.all, instance.value?.conditions?.any).some(
        cond => cond?.field === 'custom_status_id',
      ),
    )
    .map(
      (instance): ChangeError => ({
        elemID: instance.elemID,
        severity: 'Error',
        message: "View includes a condition on field 'custom_status_id' but custom ticket statuses are disabled",
        detailedMessage:
          "View includes a condition on field 'custom_status_id' but custom ticket statuses are disabled. To apply conditions on custom ticket statuses, please activate this feature first. For help see: https://support.zendesk.com/hc/en-us/articles/4412575841306-Activating-custom-ticket-statuses.",
      }),
    )
}
