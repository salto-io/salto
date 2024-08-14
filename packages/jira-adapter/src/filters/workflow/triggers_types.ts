/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, MapType } from '@salto-io/adapter-api'
import { elements } from '@salto-io/adapter-components'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { JIRA } from '../../constants'
import { Trigger } from './types'

export const triggerType = createMatchingObjectType<Trigger>({
  elemID: new ElemID(JIRA, 'Trigger'),
  fields: {
    key: { refType: BuiltinTypes.STRING, annotations: { [CORE_ANNOTATIONS.CREATABLE]: true } },
    configuration: {
      refType: new MapType(BuiltinTypes.UNKNOWN),
      annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
    },
  },
  path: [JIRA, elements.TYPES_PATH, 'Trigger'],
})
