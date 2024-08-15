/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { ElemID, Values, Element, TemplateExpression } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA } from '../../../../src/constants'

export const createQueueValues = (name: string, allElements: Element[]): Values => ({
  name,
  jql: new TemplateExpression({
    parts: [
      createReference(new ElemID(JIRA, 'Field', 'instance', 'Resolution__resolution'), allElements),
      ' = UNRESOLVED',
    ],
  }),
  columns: [
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Issue_Type__issuetype@suu'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Key'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Summary__string'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Reporter__user'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements),
    createReference(new ElemID(JIRA, 'Field', 'instance', 'Status__status'), allElements),
  ],
  canBeHidden: false,
  favourite: false,
})
