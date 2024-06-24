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
import { Credentials } from '../src/client/credentials'

const log = logger(module)

export const credsSpec = (envName?: string): CredsSpec<Required<Credentials>> => {
  const addEnvName = (varName: string): string => (envName === undefined ? varName : [varName, envName].join('_'))
  const accountIdEnvVarName = addEnvName('NS_ACCOUNT_ID')
  const tokenIdEnvVarName = addEnvName('NS_TOKEN_ID')
  const tokenSecretEnvVarName = addEnvName('NS_TOKEN_SECRET')
  const suiteAppTokenIdEnvVarName = addEnvName('NS_SUITE_APP_TOKEN_ID')
  const suiteAppTokenSecretEnvVarName = addEnvName('NS_SUITE_APP_TOKEN_SECRET')
  const suiteAppActivationKeyEnvVarName = addEnvName('NS_SUITE_APP_ACTIVATION_KEY')
  return {
    envHasCreds: env => accountIdEnvVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        accountId: envUtils.required(accountIdEnvVarName),
        tokenId: envUtils.required(tokenIdEnvVarName),
        tokenSecret: envUtils.required(tokenSecretEnvVarName),
        suiteAppTokenId: envUtils.required(suiteAppTokenIdEnvVarName),
        suiteAppTokenSecret: envUtils.required(suiteAppTokenSecretEnvVarName),
        suiteAppActivationKey: envUtils.required(suiteAppActivationKeyEnvVarName),
      }
    },
    validate: async (_credentials: Credentials): Promise<void> => {
      // When validating netsuite credentials it requires the test runner to have java and
      // access to the SDF jar. In SaaS, which uses this class we can't use the tested env's SDF jar
      // when running against staging and prod from the test runner, opposed to regular backend e2e
      // tests. Thus we skip the credentials validation in e2e tests.
    },
    typeName: 'netsuite',
    globalProp: envName ? `netsuite_${envName}` : 'netsuite',
  }
}

export default class NetsuiteE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
