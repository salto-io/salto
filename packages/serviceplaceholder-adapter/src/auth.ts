/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import * as constants from './constants'

// TODO adjust based on the needed auth
export type Credentials = {
  subdomain: string
  username: string
  password: string
}

export const credentialsType = createMatchingObjectType<Credentials>({
  elemID: new ElemID(constants.ADAPTER_NAME),
  fields: {
    // TODO adjust according to above (fields should match)
    subdomain: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    username: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    password: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
  },
})
