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
import { ElemID, ObjectType, BuiltinTypes } from '@salto-io/adapter-api'
import { auth as authUtils } from '@salto-io/adapter-components'
import * as constants from './constants'

const configID = new ElemID(constants.SAP)

export const oauthClientCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'OAuth client ID' },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'OAuth client secret' },
    },
    authorizationUrl: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'Authorization url' },
    },
    baseUrl: {
      refType: BuiltinTypes.STRING,
      annotations: { message: 'Base service url' },
    },
  },
})

export type OAuthClientCredentials = authUtils.OAuthClientCredentialsArgs & {
  authUrl: string
  baseUrl: string
}

export type Credentials = OAuthClientCredentials
