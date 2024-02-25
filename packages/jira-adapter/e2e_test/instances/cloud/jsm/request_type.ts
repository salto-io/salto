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
