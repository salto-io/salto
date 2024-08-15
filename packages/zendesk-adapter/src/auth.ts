/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import _ from 'lodash'
import * as constants from './constants'

const PASSWORD_MESSAGE = 'Password authentication is deprecated by Zendesk, please use token instead'
const SUBDOMAIN_MESSAGE = 'Subdomain (https://<your subdomain>.zendesk.com)'
const DOMAIN_MESSAGE =
  'Domain (optional) - only fill in if your account is not under zendesk.com (https://<subdomain>.<your zendesk domain>)'

type CommonBasicCredentials = {
  username: string
  subdomain: string
  domain?: string
}

export type UsernamePasswordCredentials = CommonBasicCredentials & {
  password: string
}
export type APITokenCredentials = CommonBasicCredentials & {
  token: string
}

export type BasicCredentials = UsernamePasswordCredentials | APITokenCredentials

export type OauthAccessTokenCredentials = {
  accessToken: string
  subdomain: string
  domain?: string
}

export type OauthRequestParameters = {
  clientId: string
  port: number
  subdomain: string
  domain?: string
}

// The type here is to allow token or password to be optional
export const basicCredentialsType = createMatchingObjectType<
  CommonBasicCredentials & Partial<UsernamePasswordCredentials | APITokenCredentials>
>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    username: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
    password: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: PASSWORD_MESSAGE,
      },
    },
    token: {
      refType: BuiltinTypes.STRING,
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

export const oauthAccessTokenCredentialsType = createMatchingObjectType<OauthAccessTokenCredentials>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    accessToken: {
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

export const oauthRequestParametersType = createMatchingObjectType<OauthRequestParameters>({
  elemID: new ElemID(constants.ZENDESK),
  fields: {
    clientId: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'Client ID',
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
    subdomain: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'subdomain',
        _required: true,
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

export type Credentials = BasicCredentials | OauthAccessTokenCredentials

export const isOauthAccessTokenCredentials = (creds: Credentials): creds is OauthAccessTokenCredentials =>
  'accessToken' in creds

export const isAPITokenCredentials = (creds: Credentials): creds is APITokenCredentials =>
  'token' in creds && !_.isEmpty(creds.token)
