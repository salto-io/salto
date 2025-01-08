/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { JIRA, AUTOMATION_LABEL_TYPE } from '../../../constants'

export const createAutomationLabelType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, AUTOMATION_LABEL_TYPE),
    fields: {
      name: { refType: BuiltinTypes.STRING },
      color: { refType: BuiltinTypes.STRING },
      id: {
        refType: BuiltinTypes.SERVICE_ID_NUMBER,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      },
    },
    path: [JIRA, elements.TYPES_PATH, AUTOMATION_LABEL_TYPE],
  })
