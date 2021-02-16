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
import { ElemID, ObjectType, BuiltinTypes } from '@salto-io/adapter-api'
import * as constants from './constants'

export const usernameTokenCredentialsType = new ObjectType({
  elemID: new ElemID(constants.WORKATO),
  fields: {
    username: { type: BuiltinTypes.STRING },
    token: {
      type: BuiltinTypes.STRING,
    },
  },
})

export class UsernameTokenCredentials {
  constructor({ username, token }:
    { username: string; token: string }) {
    this.username = username
    this.token = token
  }

  username: string
  token: string
}

export type Credentials = UsernameTokenCredentials
