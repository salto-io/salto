/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  createEnvUtils,
  CredsSpec,
  JestEnvironmentConstructorArgs,
  SaltoE2EJestEnvironment,
} from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { Credentials } from '../src/auth'

const log = logger(module)

export const credsSpec = (): CredsSpec<Required<Credentials>> => {
  const googleWorkspaceClientIdVarName = 'GOOGLE_WORKSPACE_CLIENT_ID'
  const googleWorkspaceClientSecretVarName = 'GOOGLE_WORKSPACE_CLIENT_SECRET'
  const googleWorkspaceRefreshTokenVarName = 'GOOGLE_WORKSPACE_REFRESH_TOKEN'
  return {
    envHasCreds: env => googleWorkspaceClientIdVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        clientId: envUtils.required(googleWorkspaceClientIdVarName),
        clientSecret: envUtils.required(googleWorkspaceClientSecretVarName),
        refreshToken: envUtils.required(googleWorkspaceRefreshTokenVarName),
      }
    },
    validate: async (_creds: Credentials): Promise<void> => undefined,
    typeName: 'google-workspace',
    globalProp: 'google-workspace',
  }
}

export default class GoogleWorkspaceE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
