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

import { GetInsightsFunc } from '@salto-io/adapter-api'
import supportAddressesInsights from './support_addresses'
import triggersInsights from './triggers'
import automationsInsights from './automations'
import accountFeaturesInsights from './account_features'
import accountSettingsInsights from './account_settings'

const getInsights: GetInsightsFunc = elements =>
  supportAddressesInsights(elements)
    .concat(triggersInsights(elements))
    .concat(automationsInsights(elements))
    .concat(accountFeaturesInsights(elements))
    .concat(accountSettingsInsights(elements))

export default getInsights
