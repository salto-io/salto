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
import { logger } from '@salto-io/logging'
import {
  CredsJestEnvironment,
  createEnvUtils,
  CredsSpec,
  SuspendCredentialsError,
  JestEnvironmentConstructorArgs,
} from '@salto-io/e2e-credentials-store'
import {
  Credentials,
  validateCredentials,
  getRemainingDailyRequests,
  ApiLimitsTooLowError,
} from '../src/client/client'

const MIN_API_REQUESTS_NEEDED = 500
const NOT_ENOUGH_API_REQUESTS_SUSPENSION_TIMEOUT = 1000 * 60 * 60

const log = logger(module)

export const credsSpec = (envName?: string): CredsSpec<Credentials> => {
  const userEnvVarName = envName === undefined ? 'SF_USER' : `SF_USER_${envName}`
  const passwordEnvVarName = envName === undefined ? 'SF_PASSWORD' : `SF_PASSWORD_${envName}`
  const tokenEnvVarName = envName === undefined ? 'SF_TOKEN' : `SF_TOKEN_${envName}`
  const sandboxEnvVarName = envName === undefined ? 'SF_SANDBOX' : `SF_SANDBOX_${envName}`
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

export default class SalesforceCredsEnvironment extends CredsJestEnvironment<Credentials> {
  dailyEnv1RequestsRemainingOnSetup: number | undefined
  dailyEnv2RequestsRemainingOnSetup: number | undefined

  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace, credsSpecs: [credsSpec(), credsSpec('ENV_2')] }, ...args)
  }

  async setup(): Promise<void> {
    await super.setup()
    const [dailyEnv1Requests, dailyEnv2Requests] = await Promise.all(
      (this.credsLeases ?? []).map(lease => getRemainingDailyRequests(lease.value))
    )
    if (dailyEnv1Requests && dailyEnv2Requests) {
      this.dailyEnv1RequestsRemainingOnSetup = dailyEnv1Requests
      this.log.warn('remaining daily requests on creds env1: %o', dailyEnv1Requests)
      this.dailyEnv2RequestsRemainingOnSetup = dailyEnv2Requests
      this.log.warn('remaining daily requests on creds env2: %o', dailyEnv1Requests)
    }
  }

  async teardown(): Promise<void> {
    if (this.dailyEnv1RequestsRemainingOnSetup !== undefined
      && this.dailyEnv2RequestsRemainingOnSetup !== undefined) {
      const [remainingEnv1Requests, remainingEnv2Requests] = await Promise.all(
        (this.credsLeases ?? []).map(lease => getRemainingDailyRequests(lease.value))
      )
      const usedRequestsEnv1 = this.dailyEnv1RequestsRemainingOnSetup - remainingEnv1Requests
      this.log.warn('this run used %o of daily requests quota for env 1:', usedRequestsEnv1)
      const usedRequestsEnv2 = this.dailyEnv2RequestsRemainingOnSetup - remainingEnv2Requests
      this.log.warn('this run used %o of daily requests quota for env 2:', usedRequestsEnv2)
    }
    await super.teardown()
  }
}
