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

import { ElemID, GetInsightsFunc, isInstanceElement } from '@salto-io/adapter-api'
import { JIRA, WORKFLOW_TYPE_NAME } from '../constants'
import { isWorkflowInstance } from '../filters/workflowV2/types'
import { FIELD_TYPE_NAME } from '../filters/fields/constants'
import { isFieldInstance } from './custom_fields'

const THRESHOLD = 'threshold'

const getInsights: GetInsightsFunc = elements => {
  const instances = elements.filter(isInstanceElement)

  return [
    {
      path: new ElemID(JIRA, WORKFLOW_TYPE_NAME),
      ruleId: `${THRESHOLD}.workflows`,
      message: `Account has ${instances.filter(isWorkflowInstance).length} workflows`,
    },
    {
      path: new ElemID(JIRA, FIELD_TYPE_NAME),
      ruleId: `${THRESHOLD}.fields`,
      message: `Account has ${instances.filter(isFieldInstance).length} fields`,
    },
  ]
}

export default getInsights
