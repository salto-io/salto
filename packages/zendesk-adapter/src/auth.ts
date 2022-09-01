/*
*                      Copyright 2022 Salto Labs Ltd.
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

export type UsernamePasswordCredentials = {
  username: string
  password: string
  subdomain: string
}

export type OauthAccessTokenCredentials = {
  accessToken: string
  subdomain: string
}

export type OauthRequestParameters = {
  clientId: string
  port: number
  subdomain: string
}

export const usernamePasswordCredentialsType = createMatchingObjectType<
  UsernamePasswordCredentials
>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    username: {
      refType: BuiltinTypes.STRING,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      annotations: { _required: true },
    },
    password: {
      refType: BuiltinTypes.STRING,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      annotations: { _required: true },
    },
    subdomain: {
      refType: BuiltinTypes.STRING,
      annotations: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        _required: true,
        message: 'subdomain (https://<your subdomain>.zendesk.com)',
      },
    },
  },
})

export const oauthAccessTokenCredentialsType = createMatchingObjectType<
  OauthAccessTokenCredentials
>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    accessToken: {
      refType: BuiltinTypes.STRING,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      annotations: { _required: true },
    },
    subdomain: {
      refType: BuiltinTypes.STRING,
      annotations: {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        _required: true,
        message: 'subdomain (https://<your subdomain>.zendesk.com)',
      },
    },
  },
})

export const oauthRequestParametersType = createMatchingObjectType<
  OauthRequestParameters
>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client ID',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        _required: true,
      },
    },
    port: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        message: 'Port',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        _required: true,
      },
    },
    subdomain: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'subdomain',
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        _required: true,
      },
    },
  },
})

export type Credentials = UsernamePasswordCredentials | OauthAccessTokenCredentials

export const isOauthAccessTokenCredentials = (
  creds: Credentials
): creds is OauthAccessTokenCredentials =>
  (creds as OauthAccessTokenCredentials).accessToken !== undefined
