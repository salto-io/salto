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

const SUBDOMAIN_MESSAGE = 'subdomain (https://<your subdomain>.sap.com)'
const DOMAIN_MESSAGE = 'domain (optional) - only fill in if your account is not under sap.com (https://<subdomain>.<your sap domain>)'

export type UsernamePasswordCredentials = {
  username: string
  password: string
  subdomain: string
  domain?: string
}

export const usernamePasswordCredentialsType = createMatchingObjectType<
  UsernamePasswordCredentials
>({
  elemID: new ElemID(constants.SAP),
  fields: {
    username: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    password: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    subdomain: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
        message: SUBDOMAIN_MESSAGE,
      },
    },
    domain: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: false,
        message: DOMAIN_MESSAGE,
      },
    },
  },
})

export type Credentials = UsernamePasswordCredentials
