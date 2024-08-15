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

export const credsSpec = (envName?: string): CredsSpec<Required<Credentials>> => {
  const addEnvName = (varName: string): string => (envName === undefined ? varName : [varName, envName].join('_'))
  const oktaBaseUrlVarName = addEnvName('OKTA_BASE_URL')
  const oktaTokenVarName = addEnvName('OKTA_TOKEN')
  return {
    envHasCreds: env => oktaBaseUrlVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        baseUrl: envUtils.required(oktaBaseUrlVarName),
        token: envUtils.required(oktaTokenVarName),
      }
    },
    validate: async (_creds: Credentials): Promise<void> => {
      // TODO
    },
    typeName: 'okta',
    globalProp: envName ? `okta_${envName}` : 'okta',
  }
}

export default class OktaE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
