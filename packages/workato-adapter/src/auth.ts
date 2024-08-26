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

export type UsernameTokenCredentials = {
  username?: string
  token: string
}

export const usernameTokenCredentialsType = createMatchingObjectType<UsernameTokenCredentials>({
  elemID: new ElemID(constants.WORKATO),
  fields: {
    username: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'username (optional) - keep empty if using token-based authentication',
      },
    },
    token: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
  },
})

export type Credentials = UsernameTokenCredentials
