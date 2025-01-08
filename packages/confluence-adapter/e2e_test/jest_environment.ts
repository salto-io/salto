/*
 * Copyright 2025 Salto Labs Ltd.
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
  const confluenceTokenVarName = 'CONFLUENCE_TOKEN'
  const confluenceUserVarName = 'CONFLUENCE_USER'
  const confluenceBaseUrlVarName = 'CONFLUENCE_BASEURL'
  return {
    envHasCreds: env => confluenceUserVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        token: envUtils.required(confluenceTokenVarName),
        user: envUtils.required(confluenceUserVarName),
        baseUrl: envUtils.required(confluenceBaseUrlVarName),
      }
    },
    validate: async (_creds: Credentials): Promise<void> => undefined,
    typeName: 'confluence',
    globalProp: 'confluence',
  }
}

export default class ConfluenceE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
