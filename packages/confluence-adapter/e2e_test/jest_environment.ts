/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
