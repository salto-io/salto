/*
*                      Copyright 2021 Salto Labs Ltd.
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
import _ from 'lodash'
import { ElemID, ObjectType, BuiltinTypes, InstanceElement } from '@salto-io/adapter-api'
import { auth as authUtils } from '@salto-io/adapter-components'
import * as constants from './constants'

const configID = new ElemID(constants.ZUORA_BILLING)

export const usernamePasswordCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    username: { type: BuiltinTypes.STRING },
    password: { type: BuiltinTypes.STRING },
    baseURL: {
      type: BuiltinTypes.STRING,
      annotations: { message: 'Base URL (e.g. https://rest.sandbox.na.zuora.com)' },
    },
  },
})

export const oauthClientCredentialsType = new ObjectType({
  elemID: configID,
  fields: {
    clientId: {
      type: BuiltinTypes.STRING,
      annotations: { message: 'OAuth client ID' },
    },
    clientSecret: {
      type: BuiltinTypes.STRING,
      annotations: { message: 'OAuth client secret' },
    },
    baseURL: {
      type: BuiltinTypes.STRING,
      annotations: { message: 'Base URL (e.g. https://rest.sandbox.na.zuora.com)' },
    },
  },
})

export type OAuthClientCredentials = authUtils.OAuthClientCredentialsArgs & {
  baseURL: string
}

export type UsernamePasswordCredentials = {
  username: string
  password: string
  baseURL: string
}

export type Credentials = OAuthClientCredentials | UsernamePasswordCredentials

export const isUsernamePasswordCredentials = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  creds: any
): creds is UsernamePasswordCredentials => (
  creds !== undefined
  && _.isString(creds.username)
  && _.isString(creds.password)
  && _.isString(creds.baseURL)
)

export const isOAuthClientCredentials = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  creds: any
): creds is OAuthClientCredentials => (
  creds !== undefined
  && _.isString(creds.clientId)
  && _.isString(creds.clientSecret)
  && _.isString(creds.baseURL)
)

export const isOAuthClientCredentialsConfig = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  credsInstance: Readonly<InstanceElement>
): boolean => (
  isOAuthClientCredentials(credsInstance.value)
)
