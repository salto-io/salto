/*
*                      Copyright 2020 Salto Labs Ltd.
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
  SuspendCredentialsError,
  SaltoE2EJestEnvironment,
  JestEnvironmentConstructorArgs,
} from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import {
  Credentials,
  validateCredentials,
  ApiLimitsTooLowError,
} from '../src/client/client'


const log = logger(module)

const MIN_API_REQUESTS_NEEDED = 1000
const NOT_ENOUGH_API_REQUESTS_SUSPENSION_TIMEOUT = 1000 * 60 * 60

export const credsSpec = (envName?: string): CredsSpec<Credentials> => {
  const addEnvName = (varName: string): string => (envName === undefined
    ? varName
    : [varName, envName].join('_'))
  const userEnvVarName = addEnvName('SF_USER')
  const passwordEnvVarName = addEnvName('SF_PASSWORD')
  const tokenEnvVarName = addEnvName('SF_TOKEN')
  const sandboxEnvVarName = addEnvName('SF_SANDBOX')
  return {
    envHasCreds: env => userEnvVarName in env,
    fromEnv: env => {
      const envUtils = createEnvUtils(env)
      return {
        username: envUtils.required(userEnvVarName),
        password: envUtils.required(passwordEnvVarName),
        apiToken: env[tokenEnvVarName] ?? '',
        isSandbox: envUtils.bool(sandboxEnvVarName),
      }
    },
    validate: async (creds: Credentials): Promise<void> => {
      try {
        await validateCredentials(creds, MIN_API_REQUESTS_NEEDED)
      } catch (e) {
        if (e instanceof ApiLimitsTooLowError) {
          throw new SuspendCredentialsError(e, NOT_ENOUGH_API_REQUESTS_SUSPENSION_TIMEOUT)
        }
        throw e
      }
    },
    typeName: 'salesforce',
    globalProp: envName ? `salesforce_${envName}` : 'salseforce',
  }
}

export default class SalesforceE2EJestEnvironment extends SaltoE2EJestEnvironment {
  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace }, ...args)
  }
}
