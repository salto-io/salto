/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { OauthAccessTokenCredentials, oauthAccessTokenCredentialsType } from './client/oauth'
import * as constants from './constants'

type BasicCredentials = {
  accessToken: string
}

export const basicCredentialsType = createMatchingObjectType<BasicCredentials>({
  elemID: new ElemID(constants.ADAPTER_NAME),
  fields: {
    accessToken: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'Access Token', _required: true },
    },
  },
})

export const credentialsType = oauthAccessTokenCredentialsType || basicCredentialsType

export type Credentials = OauthAccessTokenCredentials | BasicCredentials
