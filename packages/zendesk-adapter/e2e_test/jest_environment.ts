/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  createEnvUtils,
  CredsSpec,
  SaltoE2EJestEnvironment,
  JestEnvironmentConstructorArgs,
} from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { UsernamePasswordCredentials } from '../src/auth'

const log = logger(module)

export const credsSpec = (envName?: string): CredsSpec<UsernamePasswordCredentials> => {
  const addEnvName = (varName: string): string => (envName === undefined ? varName : [varName, envName].join('_'))
  const userNameEnvVarName = addEnvName('ZENDESK_USERNAME')
  const passwordEnvVarName = addEnvName('ZENDESK_PASSWORD')
  const subdomainEnvVarName = addEnvName('ZENDESK_SUBDOMAIN')
  return {
    envHasCreds: env => userNameEnvVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        username: envUtils.required(userNameEnvVarName),
        password: envUtils.required(passwordEnvVarName),
        subdomain: envUtils.required(subdomainEnvVarName),
      }
    },
    validate: async (_creds: UsernamePasswordCredentials): Promise<void> => {
      // TODO validate when connecting with real credentials
    },
    typeName: 'zendesk',
    globalProp: envName ? `zendesk_${envName}` : 'zendesk',
  }
}

export default class ZendeskE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
