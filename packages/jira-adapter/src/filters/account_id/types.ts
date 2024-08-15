/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ListType, ObjectType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { ACCOUNT_ID_INFO_TYPE, JIRA } from '../../constants'

export const accountIdInfoType = new ObjectType({
  elemID: new ElemID(JIRA, ACCOUNT_ID_INFO_TYPE),
  fields: {
    id: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      },
    },
    displayName: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      },
    },
  },
  path: [JIRA, elements.TYPES_PATH, elements.SUBTYPES_PATH, ACCOUNT_ID_INFO_TYPE],
})

export const accountIdInfoListType = new ListType(accountIdInfoType)
