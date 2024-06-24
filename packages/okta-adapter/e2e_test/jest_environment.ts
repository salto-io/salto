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
