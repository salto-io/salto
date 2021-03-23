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
import { ObjectType, InstanceElement } from './elements'
import { Values } from './values'

export type OAuthRequestParameters = {
  url: string
  accessTokenField: string
}

export type AuthMethod = {
  credentialsType: ObjectType
}

export type OAuthMethod = AuthMethod & {
  oauthRequestParameters: ObjectType
  createOAuthRequest: (userInput: InstanceElement) => OAuthRequestParameters
  createFromOauthResponse: (oldConfig: Values, response: OauthAccessTokenResponse) => Values
}

export type AdapterAuthentication = {
  basic: AuthMethod
  oauth?: OAuthMethod
  limited?: AuthMethod
}

export type OauthAccessTokenResponse = {
  instanceUrl: string
  accessToken: string
}

export type AdapterAuthMethod = keyof AdapterAuthentication
