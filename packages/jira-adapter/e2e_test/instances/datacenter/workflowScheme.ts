/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values, Element, ElemID } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { ISSUE_TYPE_NAME, JIRA, WORKFLOW_TYPE_NAME } from '../../../src/constants'

export const createWorkflowSchemeValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  defaultWorkflow: createReference(new ElemID(JIRA, WORKFLOW_TYPE_NAME, 'instance', 'jira'), allElements),
  items: [
    {
      issueType: createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Bug'), allElements),
      workflow: createReference(new ElemID(JIRA, WORKFLOW_TYPE_NAME, 'instance', 'jira'), allElements),
    },
  ],
})
