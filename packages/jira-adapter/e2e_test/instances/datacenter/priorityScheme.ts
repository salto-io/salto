/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../utils'
import { JIRA, PRIORITY_TYPE_NAME } from '../../../src/constants'

export const createPrioritySchemeValues = (name: string, allElements: Element[]): Values => ({
  name,
  description: `desc-${name}`,
  optionIds: [
    createReference(new ElemID(JIRA, PRIORITY_TYPE_NAME, 'instance', 'Highest'), allElements),
    createReference(new ElemID(JIRA, PRIORITY_TYPE_NAME, 'instance', 'High'), allElements),
  ],
  defaultOptionId: createReference(new ElemID(JIRA, PRIORITY_TYPE_NAME, 'instance', 'High'), allElements),
})
