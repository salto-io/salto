/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
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
import { e2eUtils } from '@salto-io/microsoft-security-adapter'

const log = logger(module)

export const credsSpec = (envName?: string): CredsSpec<Required<e2eUtils.Credentials>> => {
  const addEnvName = (varName: string): string => (envName === undefined ? varName : [varName, envName].join('_'))
  const microsoftSecurityTenantIdVarName = addEnvName('MICROSOFT_SECURITY_TENANT_ID')
  const microsoftSecurityClientIdVarName = addEnvName('MICROSOFT_SECURITY_CLIENT_ID')
  const microsoftSecurityClientSecretVarName = addEnvName('MICROSOFT_SECURITY_CLIENT_SECRET')
  const microsoftSecurityRefreshTokenVarName = addEnvName('MICROSOFT_SECURITY_REFRESH_TOKEN')
  return {
    envHasCreds: env => microsoftSecurityTenantIdVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        tenantId: envUtils.required(microsoftSecurityTenantIdVarName),
        clientId: envUtils.required(microsoftSecurityClientIdVarName),
        clientSecret: envUtils.required(microsoftSecurityClientSecretVarName),
        refreshToken: envUtils.required(microsoftSecurityRefreshTokenVarName),
        servicesToManage: { Entra: true, Intune: true },
      }
    },
    validate: async (_creds: e2eUtils.Credentials): Promise<void> => {
      // TODO
    },
    typeName: 'microsoft_security',
    globalProp: envName ? `microsoft_security_${envName}` : 'microsoft_security',
  }
}

export default class MicrosoftSecurityE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
