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
import _ from 'lodash'
import { ElemID, ObjectType, BuiltinTypes } from '@salto-io/adapter-api'
import { auth as authUtils } from '@salto-io/adapter-components'
import * as constants from './constants'

const configID = new ElemID(constants.ZUORA_BILLING)

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
    subdomain: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message:
          'Sandbox subdomain to use, e.g. "sandbox.na" (requests will be made to https://rest.<subdomain>.zuora.com). Keep empty for production',
      },
    },
    production: { refType: BuiltinTypes.BOOLEAN },
  },
})

export type OAuthClientCredentials = authUtils.OAuthClientCredentialsArgs & {
  baseURL: string
}

export type Credentials = OAuthClientCredentials

// non-prod valid subdomain, based on https://www.zuora.com/developer/api-reference/#section/Introduction/Access-to-the-API
// should all be lowercase
export const KNOWN_SANDBOX_SUBDOMAIN_KEYWORDS = new Set(['apisandbox', 'sandbox', 'test', 'pt1'])

export const isSandboxSubdomain = (subdomain: string): boolean =>
  subdomain
    .toLowerCase()
    .split('.')
    .some(part => KNOWN_SANDBOX_SUBDOMAIN_KEYWORDS.has(part))

export const toZuoraBaseUrl = (subdomain: string): string =>
  _.isEmpty(subdomain) ? 'https://rest.zuora.com' : `https://rest.${subdomain}.zuora.com`
