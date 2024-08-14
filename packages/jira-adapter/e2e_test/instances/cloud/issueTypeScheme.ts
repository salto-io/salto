/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values, Element, ElemID } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { ISSUE_TYPE_NAME, JIRA } from '../../../src/constants'

export const createIssueTypeSchemeValues = (name: string, allElements: Element[]): Values => ({
  name,
  defaultIssueTypeId: createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Bug'), allElements),
  issueTypeIds: [
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Bug'), allElements),
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Epic'), allElements),
  ],
})
