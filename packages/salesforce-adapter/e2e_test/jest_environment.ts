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

export const credsSpec: CredsSpec<Credentials> = {
  envHasCreds: env => 'SF_USER' in env,
  fromEnv: env => {
    const envUtils = createEnvUtils(env)
    return {
      username: envUtils.required('SF_USER'),
      password: envUtils.required('SF_PASSWORD'),
      apiToken: env.SF_TOKEN ?? '',
      isSandbox: envUtils.bool('SF_SANDBOX'),
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
  globalProp: 'salesforceCredentials',
}

export default class SalesforceCredsEnvironment extends CredsJestEnvironment<Credentials> {
  dailyRequestsRemainingOnSetup: number | undefined

  constructor(...args: JestEnvironmentConstructorArgs) {
    super({ logBaseName: log.namespace, credsSpec }, ...args)
  }

  async setup(): Promise<void> {
    await super.setup()
    if (this.credsLease) {
      this.dailyRequestsRemainingOnSetup = await getRemainingDailyRequests(this.credsLease.value)
      this.log.warn('remaining daily requests on creds %o: %o', this.credsLease.id, this.dailyRequestsRemainingOnSetup)
    }
  }

  async teardown(): Promise<void> {
    if (this.credsLease && this.dailyRequestsRemainingOnSetup !== undefined) {
      const dailyRequestsRemainingOnTeardown = await getRemainingDailyRequests(
        this.credsLease.value,
      )
      const usedRequests = this.dailyRequestsRemainingOnSetup - dailyRequestsRemainingOnTeardown
      this.log.warn('this run used %o of daily requests quota', usedRequests)
    }
    await super.teardown()
  }
}
