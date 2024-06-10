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
import { ACCOUNT_FEATURES_TYPE_NAME, ZENDESK } from '../constants'

const ACCOUNT_FEATURES = 'accountFeatures'

const ACCOUNT_FEATURES_ELEMENT_ID = new ElemID(ZENDESK, ACCOUNT_FEATURES_TYPE_NAME, 'instance', ElemID.CONFIG_NAME)

const isAccountFeaturesInstance = (instance: InstanceElement): boolean =>
  instance.elemID.isEqual(ACCOUNT_FEATURES_ELEMENT_ID)

const getInsights: GetInsightsFunc = elements => {
  const accountFeatures = elements.filter(isInstanceElement).find(isAccountFeaturesInstance)

  const disabled2FA =
    // this is not the right field
    accountFeatures?.value.use_login_ui_for_2fa?.enabled === false
      ? [
          {
            path: ACCOUNT_FEATURES_ELEMENT_ID,
            ruleId: `${ACCOUNT_FEATURES}.disabled2FA`,
            message: '2FA feature is disabled',
          },
        ]
      : []

  return disabled2FA
}

export default getInsights
