/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
