/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA } from '../../../../src/constants'

export const createScriptRunnerListenerValues = (name: string, allElements: Element[]): Values => ({
  projects: [createReference(new ElemID(JIRA, 'Project', 'instance', 'Test_Project@s'), allElements)],
  script: 'import java.time.LocalDate;return LocalDate.now().minusDays(1)',
  enabled: true,
  events: ['comment_created'],
  executionCondition: 'AA = B',
  description: name,
  executionUser: 'INITIATING_USER',
})
