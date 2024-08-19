/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, TemplateExpression, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA, PROJECT_TYPE } from '../../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../../src/filters/fields/constants'

export const createEscalationServiceValues = (name: string, allElements: Element[]): Values => ({
  name,
  atlassianUser: {
    accountId: {
      id: '61d44bf59ee70a00685fa6b6',
      displayName: 'Testing salto',
    },
  },
  script: 'import java.util.Calendar',
  enabled: true,
  cronExpression: '0 0 12 ? * 2,3,4,5,6',
  jql: new TemplateExpression({
    parts: [
      createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Project__project'), allElements),
      ' = ',
      createReference(new ElemID(JIRA, PROJECT_TYPE, 'instance', 'Test_Project@s'), allElements, ['key']),
    ],
  }),
})
