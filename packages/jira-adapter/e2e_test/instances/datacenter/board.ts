/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
        statuses: [createReference(new ElemID(JIRA, 'Status', 'instance', 'done'), allElements)],
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
        statuses: [createReference(new ElemID(JIRA, 'Status', 'instance', 'done'), allElements)],
      },
    ],
  },
  estimation: {
    field: createReference(new ElemID(JIRA, 'Field', 'instance', 'Story_Points__float__c@suuuu'), allElements),
    timeTracking: createReference(new ElemID(JIRA, 'Field', 'instance', 'Remaining_Estimate__number@suu'), allElements),
  },
})
