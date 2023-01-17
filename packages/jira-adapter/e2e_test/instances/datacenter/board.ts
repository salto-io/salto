/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { createReference } from '../../utils'
import { JIRA } from '../../../src/constants'


export const createKanbanBoardValues = (name: string, allElements: Element[]): Values => ({
  name: `kanban${name}`,
  type: 'kanban',
  filterId: createReference(new ElemID(JIRA, 'Filter', 'instance', 'Filter_for_TP_board@s'), allElements),
  columnConfig: {
    columns: [
      {
        name: 'first',
      },
      {
        name: 'second',
        statuses: [
          createReference(new ElemID(JIRA, 'Status', 'instance', 'done'), allElements),
        ],
        min: 2,
        max: 4,
      },
    ],
    constraintType: 'issueCount',
  },
  subQuery: 'fixVersion in unreleasedVersions()',
})

export const createScrumBoardValues = (name: string, allElements: Element[]): Values => ({
  name: `scrum${name}`,
  type: 'scrum',
  filterId: createReference(new ElemID(JIRA, 'Filter', 'instance', 'Filter_for_TP_board@s'), allElements),
  columnConfig: {
    columns: [
      {
        name: 'first',
      },
      {
        name: 'second',
        statuses: [
          createReference(new ElemID(JIRA, 'Status', 'instance', 'done'), allElements),
        ],
      },
    ],
  },
  estimation: {
    field: createReference(new ElemID(JIRA, 'Field', 'instance', 'Story_Points__float__c@suuuu'), allElements),
    timeTracking: createReference(new ElemID(JIRA, 'Field', 'instance', 'Remaining_Estimate__number@suu'), allElements),
  },
})
