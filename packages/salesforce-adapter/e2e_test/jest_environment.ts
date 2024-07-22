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
  creds,
  CredsLease,
  CredsSpec,
  JestEnvironmentConstructorArgs,
  SaltoE2EJestEnvironment,
  SuspendCredentialsError,
} from '@salto-io/e2e-credentials-store'
import { logger } from '@salto-io/logging'
import { ApiLimitsTooLowError, validateCredentials } from '../src/client/client'
import { UsernamePasswordCredentials } from '../src/types'
import { CUSTOM_OBJECT } from '../src/constants'
import { CustomObject as tCustomObject } from '../src/client/types'

const log = logger(module)

const MIN_API_REQUESTS_NEEDED = 2000
const NOT_ENOUGH_API_REQUESTS_SUSPENSION_TIMEOUT = 1000 * 60 * 60

export const credsSpec = (
  envName?: string,
): CredsSpec<UsernamePasswordCredentials> => {
  const addEnvName = (varName: string): string =>
    envName === undefined ? varName : [varName, envName].join('_')
  const userEnvVarName = addEnvName('SF_USER')
  const passwordEnvVarName = addEnvName('SF_PASSWORD')
  const tokenEnvVarName = addEnvName('SF_TOKEN')
  const sandboxEnvVarName = addEnvName('SF_SANDBOX')
  return {
    envHasCreds: (env) => userEnvVarName in env,
    fromEnv: (env) => {
      const envUtils = createEnvUtils(env)
      return {
        username: envUtils.required(userEnvVarName),
        password: envUtils.required(passwordEnvVarName),
        apiToken: env[tokenEnvVarName] ?? '',
        isSandbox: envUtils.bool(sandboxEnvVarName),
      }
    },
    validate: async (
      credentials: UsernamePasswordCredentials,
    ): Promise<void> => {
      try {
        await validateCredentials(
          new UsernamePasswordCredentials(credentials),
          MIN_API_REQUESTS_NEEDED,
        )
      } catch (e) {
        if (e instanceof ApiLimitsTooLowError) {
          throw new SuspendCredentialsError(
            e,
            NOT_ENOUGH_API_REQUESTS_SUSPENSION_TIMEOUT,
          )
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

export type TestHelpers = {
  credentials: (
    envName?: string,
  ) => Promise<CredsLease<UsernamePasswordCredentials>>
  CUSTOM_OBJECT: string
}
export const testHelpers = (): TestHelpers => ({
  CUSTOM_OBJECT,
  credentials: (envName?: string) => creds(credsSpec(envName), log),
})
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace testTypes {
  export type CustomObject = tCustomObject
}
