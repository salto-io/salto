/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../../../utils'
import { JIRA } from '../../../../src/constants'

export const createScriptedFragmentsValues = (id: string, allElements: Element[]): Values => ({
  id,
  type: 'WebPanel',
  panelLocation: 'atl.jira.view.issue.right.context',
  rendering: 'external',
  externalContent: {
    url: 'https://status.circleci.com/',
  },
  htmlCssJsContent: {
    html: '',
    css: '',
    js: '',
  },
  entities: [createReference(new ElemID(JIRA, 'Project', 'instance', 'Test_Project@s'), allElements, ['key'])],
  no: 0,
})
