/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Values, ElemID, Element } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { JIRA } from '../../../src/constants'

export const createIssueLayoutValues = (allElements: Element[]): Values => ({
  extraDefinerId: createReference(
    new ElemID(JIRA, 'Screen', 'instance', 'TP__Kanban_Default_Issue_Screen@fssss'),
    allElements,
  ),
  issueLayoutConfig: {
    items: [
      {
        type: 'FIELD',
        sectionType: 'PRIMARY',
        key: createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
      },
    ],
  },
})
