/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  InstanceElement,
  OAuthMethod,
  OAuthRequestParameters,
  OauthAccessTokenResponse,
  Values,
} from '@salto-io/adapter-api'
import { OAuth2Client } from 'google-auth-library'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { ADAPTER_NAME } from '../constants'

export const DIRECTORY_APP_NAME = 'directory'
export const GROUP_SETTINGS_APP_NAME = 'groupSettings'
export const CLOUD_IDENTITY_APP_NAME = 'cloudIdentity'

const REQUIRED_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/admin.directory.customer',
  'https://www.googleapis.com/auth/admin.directory.rolemanagement',
  'https://www.googleapis.com/auth/admin.directory.group',
  'https://www.googleapis.com/auth/admin.directory.domain',
  'https://www.googleapis.com/auth/admin.directory.orgunit',
  'https://www.googleapis.com/auth/admin.directory.userschema',
  'https://www.googleapis.com/auth/admin.directory.resource.calendar',
  'https://www.googleapis.com/auth/apps.groups.settings',
  'https://www.googleapis.com/auth/admin.directory.user',
]

const getRedirectUri = (port: number): string => `http://localhost:${port}/extract`

export const createOAuthRequest = (userInput: InstanceElement): OAuthRequestParameters => {
  const { clientId, clientSecret, port } = userInput.value
  const redirectUri = getRedirectUri(port)
  const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)

  // Generate the url that will be used for the consent dialog.
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: REQUIRED_OAUTH_SCOPES,
    // A refresh token is only returned the first time the user consents to providing access.
    // Setting the prompt to 'consent' will force this consent every time, forcing a refresh_token to be returned.
    // We should also set the prompt to 'select_account' to ensure that the user is prompted to select an account,
    // and is not blocked to using the current account that is logged in.
    prompt: 'consent select_account',
  })

  return {
    url,
    oauthRequiredFields: ['code'],
  }
}

type OauthRequestParameters = {
  clientId: string
  clientSecret: string
  port: number
}

export type OauthAccessTokenCredentials = Omit<OauthRequestParameters, 'port'> & { refreshToken: string }

export const oauthAccessTokenCredentialsType = createMatchingObjectType<OauthAccessTokenCredentials>({
  elemID: new ElemID(ADAPTER_NAME),
  fields: {
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    clientSecret: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    refreshToken: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
  },
})

export const oauthRequestParametersType = createMatchingObjectType<OauthRequestParameters>({
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

export const createFromOauthResponse: OAuthMethod['createFromOauthResponse'] = async (
  input: Values,
  response: OauthAccessTokenResponse,
) => {
  const { clientId, clientSecret, port } = input
  const redirectUri = getRedirectUri(port)
  const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri)
  const { code } = response.fields
  const { tokens } = await oAuth2Client.getToken(code)
  return {
    refreshToken: tokens.refresh_token,
    clientId,
    clientSecret,
  }
}
