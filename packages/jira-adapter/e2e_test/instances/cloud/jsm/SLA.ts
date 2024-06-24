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

import { ElemID, Values, Element, TemplateExpression } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA } from '../../../../src/constants'

export const createSLAValues = (name: string, allElements: Element[]): Values => ({
  name,
  config: {
    definition: {
      start: [
        {
          pluginKey: 'com.atlassian.servicedesk',
          factoryKey: 'issue-created-sla-condition-factory',
          conditionId: 'issue-created-hit-condition',
          name: 'Issue Created',
        },
      ],
      stop: [
        {
          pluginKey: 'com.atlassian.servicedesk',
          factoryKey: 'comment-sla-condition-factory',
          conditionId: 'comment-for-reporter-hit-condition',
          name: 'Comment: For Customers',
        },
        {
          pluginKey: 'com.atlassian.servicedesk',
          factoryKey: 'resolution-sla-condition-factory',
          conditionId: 'resolution-set-hit-condition',
          name: 'Resolution: Set',
        },
      ],
      pause: [
        {
          pluginKey: 'com.atlassian.servicedesk',
          factoryKey: 'duedate-sla-condition-factory',
          conditionId: 'duedate-set-match-condition',
          name: 'Due Date: Set',
        },
      ],
    },
    goals: [
      {
        jqlQuery: new TemplateExpression({
          parts: [
            createReference(new ElemID(JIRA, 'Field', 'instance', 'Priority__priority'), allElements),
            ' = ',
            createReference(new ElemID(JIRA, 'Priority', 'instance', 'Highest'), allElements, ['name']),
          ],
        }),
        duration: 7200000,
        calendarId: createReference(
          new ElemID(JIRA, 'Calendar', 'instance', 'Sample_9_5_Calendar_SUP@sbsu'),
          allElements,
        ),
        defaultGoal: false,
        timeMetricId: 0,
      },
      {
        jqlQuery: '',
        duration: 28800000,
        calendarId: createReference(
          new ElemID(JIRA, 'Calendar', 'instance', 'Sample_9_5_Calendar_SUP@sbsu'),
          allElements,
        ),
        defaultGoal: true,
        timeMetricId: 0,
      },
    ],
    slaDisplayFormat: 'NEW_SLA_FORMAT',
  },
})
