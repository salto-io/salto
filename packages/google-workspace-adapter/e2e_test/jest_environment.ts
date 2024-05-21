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
