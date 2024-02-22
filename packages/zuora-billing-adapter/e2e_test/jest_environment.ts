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
