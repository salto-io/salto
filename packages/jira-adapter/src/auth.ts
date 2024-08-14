/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
