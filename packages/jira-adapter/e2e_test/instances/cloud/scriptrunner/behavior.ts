/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { ISSUE_TYPE_NAME, JIRA } from '../../../../src/constants'
import { FIELD_TYPE_NAME } from '../../../../src/filters/fields/constants'

export const createBehaviorValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: 'description',
  enabled: true,
  projects: [createReference(new ElemID(JIRA, 'Project', 'instance', 'Test_Project@s'), allElements, ['id'])],
  issueTypes: [
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Story'), allElements, ['id']),
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Bug'), allElements, ['id']),
  ],
  config: [
    {
      event: ['ONLOAD'],
      fieldName: '',
      javascript: 'getFieldById("description").setName("Customer Priority Level");',
      typescript: 'getFieldById("description").setName("Customer Priority Level");',
      affectedFields: [
        createReference(new ElemID(JIRA, FIELD_TYPE_NAME, 'instance', 'Description__string'), allElements, ['name']),
      ],
    },
  ],
})
