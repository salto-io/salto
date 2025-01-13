/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA } from '../../../../src/constants'

export const createrequestTypeValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: 'testRequestTypeDescription',
  helpText: 'testRequestTypeHelpCenter',
  issueTypeId: createReference(new ElemID(JIRA, 'IssueType', 'instance', 'Emailed_request@s'), allElements),
  workflowStatuses: [
    {
      id: createReference(new ElemID(JIRA, 'Status', 'instance', 'to_do@s'), allElements),
      custom: 'toDoStatusTest',
    },
    {
      id: createReference(new ElemID(JIRA, 'Status', 'instance', 'done'), allElements),
      custom: 'doneStatusTest',
    },
    {
      id: createReference(new ElemID(JIRA, 'Status', 'instance', 'in_progress@s'), allElements),
      custom: 'inProgressStatusTest',
    },
  ],
  avatarId: '10527',
  issueView: {
    issueLayoutConfig: {
      items: [
        {
          type: 'PANEL',
          sectionType: 'PRIMARY',
          key: 'SLA_PANEL',
          data: {
            name: 'SLAs',
          },
        },
        {
          type: 'FIELD',
          sectionType: 'PRIMARY',
          key: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
        },
      ],
    },
  },
  requestForm: {
    issueLayoutConfig: {
      items: [
        {
          type: 'FIELD',
          sectionType: 'REQUEST',
          key: createReference(new ElemID(JIRA, 'Field', 'instance', 'Summary__string'), allElements),
        },
        {
          type: 'FIELD',
          sectionType: 'REQUEST',
          key: createReference(new ElemID(JIRA, 'Field', 'instance', 'Description__string'), allElements),
        },
      ],
    },
  },
})
