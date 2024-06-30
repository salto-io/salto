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

import { GetInsightsFunc, isInstanceElement } from '@salto-io/adapter-api'
import { isWorkflowInstance } from '../filters/workflowV2/types'
import { isFieldInstance } from './custom_fields'

const THRESHOLD = 'threshold'

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement)

  const workflowsThreshold = instances.filter(isWorkflowInstance).map(instance => ({
    path: instance.elemID,
    ruleId: `${THRESHOLD}.workflows`,
    message: 'Workflows Threshold',
  }))

  const fieldsThreshold = instances.filter(isFieldInstance).map(instance => ({
    path: instance.elemID,
    ruleId: `${THRESHOLD}.fields`,
    message: 'Fields Threshold',
  }))

  return workflowsThreshold.concat(fieldsThreshold)
}

export default getInsights
