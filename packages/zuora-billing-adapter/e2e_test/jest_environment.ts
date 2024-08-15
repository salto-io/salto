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
  SaltoE2EJestEnvironment,
  JestEnvironmentConstructorArgs,
} from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { OAuthClientCredentials } from '../src/auth'

const log = logger(module)

export const credsSpec = (envName?: string): CredsSpec<Required<OAuthClientCredentials>> => {
  const addEnvName = (varName: string): string => (envName === undefined ? varName : [varName, envName].join('_'))
  const baseURLEnvVarName = addEnvName('ZA_BASE_URL')
  const clientIdEnvVarName = addEnvName('ZA_CLIENT_ID')
  const clientSecretEnvVarName = addEnvName('ZA_CLIENT_SECRET')
  return {
    envHasCreds: env => clientIdEnvVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        baseURL: envUtils.required(baseURLEnvVarName),
        clientId: envUtils.required(clientIdEnvVarName),
        clientSecret: envUtils.required(clientSecretEnvVarName),
      }
    },
    validate: async (_creds: OAuthClientCredentials): Promise<void> => {
      // TODO validate when connecting with real credentials
    },
    typeName: 'zuora_billing',
    globalProp: envName ? `zuora_billing_${envName}` : 'zuora_billing',
  }
}

export default class ZuoraE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
