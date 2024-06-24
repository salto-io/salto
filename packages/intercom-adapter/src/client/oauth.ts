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
import axios from 'axios'
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  OAuthMethod,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ADAPTER_NAME } from '../constants'

export type OauthRequestParameters = {
  clientId: string
  clientSecret: string
  port: number
}

export const oauthRequestParameters = createMatchingObjectType<OauthRequestParameters>({
  elemID: new ElemID(ADAPTER_NAME),
  fields: {
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client ID',
        _required: true,
      },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client Secret',
        _required: true,
      },
    },
    port: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        message: 'Port',
        _required: true,
      },
    },
  },
})

export const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => {
  const { clientId } = userInput.value
  const url = `https://app.intercom.com/oauth?client_id=${clientId}`

  return {
    url,
    oauthRequiredFields: ['code'],
  }
}

export const createFromOauthResponse: OAuthMethod['createFromOauthResponse'] = async (
  input: Values,
  response: OauthAccessTokenResponse,
) => {
  const { clientId, clientSecret } = input
  const { code } = response.fields
  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  }
  const httpClient = axios.create({
    headers: {
      'Content-Type': 'application/json',
    },
  })
  const res = await httpClient.post('https://api.intercom.io/auth/eagle/token', body)
  // eslint-disable-next-line camelcase
  const { access_token } = res.data
  return {
    accessToken: access_token,
  }
}
