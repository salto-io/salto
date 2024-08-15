/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { JIRA, PRIORITY_SCHEME_TYPE_NAME } from '../../../constants'

export const createPrioritySchemeType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(JIRA, PRIORITY_SCHEME_TYPE_NAME),
    fields: {
      id: {
        refType: BuiltinTypes.SERVICE_ID_NUMBER,
        annotations: {
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
        },
      },
      name: { refType: BuiltinTypes.STRING },
      description: { refType: BuiltinTypes.STRING },
      defaultOptionId: { refType: BuiltinTypes.STRING },
      defaultScheme: { refType: BuiltinTypes.BOOLEAN },
      optionIds: { refType: new ListType(BuiltinTypes.STRING) },
    },
    path: [JIRA, elements.TYPES_PATH, PRIORITY_SCHEME_TYPE_NAME],
  })
