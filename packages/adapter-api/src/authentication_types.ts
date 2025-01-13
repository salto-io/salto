/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ObjectType, InstanceElement } from './elements'
import { Values } from './values'

export type OAuthRequestParameters = {
  url: string
  oauthRequiredFields: string[]
}

export type AuthMethod = {
  credentialsType: ObjectType
}

export type OauthAccessTokenResponse = {
  fields: Record<string, string>
}

export type OAuthMethod = AuthMethod & {
  oauthRequestParameters: ObjectType
  createOAuthRequest: (userInput: InstanceElement) => OAuthRequestParameters
  createFromOauthResponse: (oldConfig: Values, response: OauthAccessTokenResponse) => Promise<Values>
}

export type AdapterAuthentication = {
  basic: AuthMethod
  oauth?: OAuthMethod
}

export type AdapterAuthMethod = keyof AdapterAuthentication
