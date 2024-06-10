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

import { ElemID, GetInsightsFunc, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { ZENDESK } from '../constants'
import { ACCOUNT_SETTING_TYPE_NAME } from '../filters/account_settings'

const ACCOUNT_SETTING = 'accountSetting'

const ACCOUNT_SETTING_ELEMENT_ID = new ElemID(ZENDESK, ACCOUNT_SETTING_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)

const isAccountSettingInstance = (instance: InstanceElement): boolean =>
  instance.elemID.isEqual(ACCOUNT_SETTING_ELEMENT_ID)

const getInsights: GetInsightsFunc = elements => {
  const accountSetting = elements.filter(isInstanceElement).find(isAccountSettingInstance)

  const disabledAutoAssignTicketsUponSolve =
    accountSetting?.value.tickets.assign_tickets_upon_solve === false
      ? [
          {
            path: ACCOUNT_SETTING_ELEMENT_ID,
            ruleId: `${ACCOUNT_SETTING}.disabledAutoAssignTicketsUponSolve`,
            message: '"Auto-assign tickets upon solve" setting is disabled',
          },
        ]
      : []

  return disabledAutoAssignTicketsUponSolve
}

export default getInsights
