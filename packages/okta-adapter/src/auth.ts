/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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

export const oauthAccessTokenCredentialsType = createMatchingObjectType<OAuthAccessTokenCredentials>({
  elemID: new ElemID(constants.OKTA),
  fields: {
    baseUrl: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    refreshToken: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
  },
})

export type Credentials = AccessTokenCredentials | OAuthAccessTokenCredentials

export const isOAuthAccessTokenCredentials = (credentials: Credentials): credentials is OAuthAccessTokenCredentials =>
  'refreshToken' in credentials
