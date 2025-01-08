/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Values, Element, ElemID } from '@salto-io/adapter-api'
import { createReference } from '../utils'
import { ISSUE_TYPE_NAME, JIRA } from '../../src/constants'

export const createFieldConfigurationSchemeValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: name,
  items: [
    {
      issueTypeId: 'default',
      fieldConfigurationId: createReference(
        new ElemID(JIRA, 'FieldConfiguration', 'instance', 'Default_Field_Configuration@s'),
        allElements,
      ),
    },
    {
      issueTypeId: createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Bug'), allElements),
      fieldConfigurationId: createReference(
        new ElemID(JIRA, 'FieldConfiguration', 'instance', 'Default_Field_Configuration@s'),
        allElements,
      ),
    },
  ],
})
