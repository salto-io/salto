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

type BasicAuthCredentials = {
  baseUrl: string
  user: string
  token: string
  isDataCenter?: boolean
}

export const basicAuthCredentialsType = createMatchingObjectType<BasicAuthCredentials>({
  elemID: new ElemID(constants.JIRA),
  fields: {
    baseUrl: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        message: 'Base URL',
      },
    },
    user: { refType: BuiltinTypes.STRING, annotations: { _required: true } },
    token: { refType: BuiltinTypes.STRING, annotations: { _required: true } },
    isDataCenter: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: { message: 'Is Data Center' },
    },
  },
})

export type Credentials = BasicAuthCredentials
export type ScriptRunnerCredentials = Record<string, never>
