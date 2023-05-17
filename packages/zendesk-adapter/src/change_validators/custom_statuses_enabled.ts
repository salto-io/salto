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
import { ChangeValidator, ElemID, getChangeData, isInstanceElement, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { ACCOUNT_FEATURES_TYPE_NAME, CUSTOM_STATUS_TYPE_NAME, ZENDESK } from '../constants'

const log = logger(module)

const areCustomStatusesEnabled = async (elementSource?: ReadOnlyElementsSource): Promise<boolean> => {
  if (elementSource == null) throw new Error('no element source was provided')

  const accountFeatures = await elementSource?.get(
    new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)
  )

  if (accountFeatures == null) throw new Error('no account features')
  if (!isInstanceElement(accountFeatures)) throw new Error('account features is not an instance element')

  const customStatusesEnabled = accountFeatures.value?.custom_statuses_enabled
  if (customStatusesEnabled == null) throw new Error('no "custom_statuses_enabled" field')

  return customStatusesEnabled.enabled
}
/**
 * Checks that the custom statuses Zendesk feature is enabled before changing
 * zendesk.custom_status fields.
 */
export const customStatusesEnabledValidator: ChangeValidator = async (
  changes,
  elementSource
) => {
  try {
    // If custom statuses are enabled there's no need to check anything else.
    if (await areCustomStatusesEnabled(elementSource)) return []
  } catch (e) {
    log.error(
      `Failed to run customStatusesEnabledValidator because ${e.message}`
    )
    return []
  }

  return changes
    .filter(change => getChangeData(change).elemID.typeName === CUSTOM_STATUS_TYPE_NAME)
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Custom statuses are not enabled.',
      detailedMessage: 'Cannot deploy custom statuses when they are not enabled in Zendesk.',
    }))
}
