/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import * as constants from './constants'

export type AccessTokenCredentials = {
  baseUrl: string
  token: string
}

export type OAuthAccessTokenCredentials = {
  baseUrl: string
  refreshToken: string
  clientId: string
  clientSecret: string
}

export const accessTokenCredentialsType = createMatchingObjectType<AccessTokenCredentials>({
  elemID: new ElemID(constants.OKTA),
  fields: {
    baseUrl: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true, message: 'Base URL (https://<your-subdomain>.okta.com/)' },
    },
    token: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
  },
})

export type Credentials = AccessTokenCredentials | OAuthAccessTokenCredentials

export const isOAuthAccessTokenCredentials = (credentials: Credentials): credentials is OAuthAccessTokenCredentials =>
  'refreshToken' in credentials
