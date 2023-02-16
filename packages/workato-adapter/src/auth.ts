/*
*                      Copyright 2023 Salto Labs Ltd.
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
