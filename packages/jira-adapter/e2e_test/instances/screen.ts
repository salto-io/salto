/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../utils'
import { JIRA } from '../../src/constants'

export const createScreenValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  tabs: {
    tab2: {
      name: 'tab2',
      position: 0,
    },
    'Field_Tab@s': {
      name: 'Field Tab',
      fields: [createReference(new ElemID(JIRA, 'Field', 'instance', 'Assignee__user'), allElements)],
      position: 2,
    },
    tab3: {
      name: 'tab3',
      fields: [
        createReference(new ElemID(JIRA, 'Field', 'instance', 'Created__datetime'), allElements),
        createReference(new ElemID(JIRA, 'Field', 'instance', 'Creator__user'), allElements),
      ],
      position: 1,
    },
  },
})
