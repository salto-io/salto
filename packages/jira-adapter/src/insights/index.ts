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
import workflowV1TransitionsInsights from './workflow_v1_transitions'
import workflowV2TransitionsInsights from './workflow_v2_transitions'
import customFieldsInsights from './custom_fields'
import fieldConfigurationsInsights from './field_configurations'
import automationsInsights from './automations'
import thresholdsInsights from './thresholds'
import projectsInsights from './projects'
import screensInsights from './screens'
import issueTypesInsights from './issue_types'

const getInsights: GetInsightsFunc = elements =>
  workflowV1TransitionsInsights(elements)
    .concat(workflowV2TransitionsInsights(elements))
    .concat(customFieldsInsights(elements))
    .concat(fieldConfigurationsInsights(elements))
    .concat(automationsInsights(elements))
    .concat(thresholdsInsights(elements))
    .concat(projectsInsights(elements))
    .concat(screensInsights(elements))
    .concat(issueTypesInsights(elements))

export default getInsights
