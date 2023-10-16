/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { handleDeploymentErrors } from '../deployment/deployment_error_handling'
import { JIRA } from '../constants'
import { ScriptRunnerLoginError, createScriptRunnerConnection } from './script_runner_connection'
import JiraClient from './client'
import { ScriptRunnerCredentials } from '../auth'

const log = logger(module)

const NO_LICENSE_ERROR_CODE = 402

const {
  DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
} = clientUtils

// The below default values are taken from Jira and were not verified for ScriptRunner
const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<clientUtils.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  get: 60,
  deploy: 2,
}

const DEFAULT_PAGE_SIZE: Required<clientUtils.ClientPageSizeConfig> = {
  get: 1000,
}

export default class ScriptRunnerClient extends clientUtils.AdapterHTTPClient<
  ScriptRunnerCredentials, clientUtils.ClientRateLimitConfig
> {
  constructor(
    clientOpts: clientUtils.ClientOpts<ScriptRunnerCredentials, clientUtils.ClientRateLimitConfig>
      & { isDataCenter: boolean; jiraClient: JiraClient},
  ) {
    super(
      JIRA,
      clientOpts,
      createScriptRunnerConnection(clientOpts.jiraClient, clientOpts.isDataCenter),
      {
        pageSize: DEFAULT_PAGE_SIZE,
        rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
        maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        retry: DEFAULT_RETRY_OPTS,
      }
    )
  }


  public async getSinglePage(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      return await super.getSinglePage({
        ...args,
        headers: {
          ...(args.headers ?? {}),
        },
      })
    } catch (e) {
      if (e instanceof ScriptRunnerLoginError) {
        log.error('Suppressing script runner login error %o', e)
        return {
          data: [],
          status: 401,
        }
      }
      // The http_client code catches the original error and transforms it such that it removes
      // the parsed information (like the status code), so we have to parse the string here in order
      // to realize what type of error was thrown
      if (e instanceof clientUtils.HTTPError && e.response?.status === 404) {
        log.warn('Suppressing 404 error %o', e)
        return {
          data: [],
          status: 404,
        }
      }
      if (e instanceof clientUtils.HTTPError && e.response?.status === NO_LICENSE_ERROR_CODE) {
        log.error('Suppressing no license error for scriptRunner %o', e)
        return {
          data: [],
          status: NO_LICENSE_ERROR_CODE,
        }
      }
      throw e
    }
  }

  @handleDeploymentErrors()
  public async sendRequest<T extends keyof clientUtils.HttpMethodToClientParams>(
    method: T,
    params: clientUtils.HttpMethodToClientParams[T]
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return super.sendRequest(method, params)
  }
}
