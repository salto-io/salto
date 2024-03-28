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
import { OauthAccessTokenCredentials, oauthAccessTokenCredentialsType } from './client/oauth'
import * as constants from './constants'

export type BasicCredentials = {
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
