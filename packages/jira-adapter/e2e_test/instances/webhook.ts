/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { Values, Element, TemplateExpression, ElemID } from '@salto-io/adapter-api'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'
import { FIELD_TYPE_NAME } from '../../src/filters/fields/constants'
import { createReference } from '../utils'

export const createWebhookValues = (name: string, allElements: Element[]): Values => ({
  name,
  url: `https://example.com/rest/webhooks/${name}`,
  excludeBody: true,
  filters: {
    issue_related_events_section: new TemplateExpression({
      parts: [
        createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Status__status'), allElements),
        ' = ',
        createReference(new ElemID(JIRA, STATUS_TYPE_NAME, 'instance', 'done'), allElements, ['name']),
      ],
    }),
  },
  events: [
    'option_watching_changed',
    'user_created',
    'jira:version_updated',
    'worklog_updated',
    'project_deleted',
    'sprint_created',
    'board_updated',
  ],
  enabled: true,
})
