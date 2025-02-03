/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, BuiltinTypes, CORE_ANNOTATIONS, createRestriction } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import * as constants from './constants'

// base URL options are documented in https://docs.workato.com/workato-api.html#base-url
export const workatoBaseUrlOptions = [
  'https://www.workato.com',
  'https://app.eu.workato.com',
  'https://app.jp.workato.com',
  'https://app.sg.workato.com',
  'https://app.au.workato.com',
]

type UsernameTokenCredentials = {
  username?: string
  baseUrl?: string
  token: string
}

export const usernameTokenCredentialsType = createMatchingObjectType<UsernameTokenCredentials>({
  elemID: new ElemID(constants.WORKATO),
  fields: {
    username: {
      refType: BuiltinTypes.STRING,
      annotations: {
        message: 'username (optional) - keep empty if using token-based authentication',
      },
    },
    baseUrl: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: false,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: workatoBaseUrlOptions }),
        message: 'base URL (optional) - only fill in if your account is not under Workato US (https://www.workato.com)',
      },
    },
    token: {
      refType: BuiltinTypes.STRING,
      annotations: { _required: true },
    },
  },
})

export type Credentials = UsernameTokenCredentials
