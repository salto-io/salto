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
import Joi from 'joi'
import { parse } from 'node-html-parser'
import { createSchemeGuard } from '@salto-io/adapter-utils'
import { handleDeploymentErrors } from '../deployment/deployment_error_handling'
import { JIRA } from '../constants'
import { createScriptRunnerConnection } from './script_runner_connection'
import ScriptRunnerCredentials from '../script_runner_auth'

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

type TokenResponse = {
  data: string
}

const TOKEN_RESPONSE_SCHEME = Joi.object({
  data: Joi.string().required(),
}).unknown(true)

const isTokenResponse = createSchemeGuard<TokenResponse>(TOKEN_RESPONSE_SCHEME, 'Failed to get script runner token from scriptRunner service')

const getSrTokenFromHtml = (html: string): string => {
  const root = parse(html)

  // Find the meta tag with name="sr-token"
  const srTokenElement = root.querySelector('meta[name="sr-token"]')
  if (srTokenElement === null) {
    log.error('Failed to get script runner token from scriptRunner service, could not find meta tag with name="sr-token"')
    return ''
  }

  // Extract the content attribute value
  const srToken = srTokenElement.getAttribute('content')

  return srToken ?? ''
}

export default class ScriptRunnerClient extends clientUtils.AdapterHTTPClient<
  ScriptRunnerCredentials, clientUtils.ClientRateLimitConfig
> {
  readonly isDataCenter: boolean
  jwTokenPromise: Promise<string> | undefined

  constructor(
    clientOpts: clientUtils.ClientOpts<ScriptRunnerCredentials, clientUtils.ClientRateLimitConfig>
      & { isDataCenter: boolean},
  ) {
    super(
      JIRA,
      clientOpts,
      createScriptRunnerConnection,
      {
        pageSize: DEFAULT_PAGE_SIZE,
        rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
        maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        retry: DEFAULT_RETRY_OPTS,
      }
    )
    this.isDataCenter = clientOpts.isDataCenter
  }

  private async getJwtFromService(): Promise<string> {
    const url = await this.credentials.getUrl()
    const baseUrl = await this.credentials.getBaseUrl()
    const srResponse = await super.getSinglePage({
      url: url.replace(baseUrl, ''),
    })

    if (!isTokenResponse(srResponse)) {
      log.error('Failed to get script runner token from scriptRunner service', srResponse)
      return ''
    }
    return getSrTokenFromHtml(srResponse.data)
  }

  private async getJwt(): Promise<string> {
    if (!this.jwTokenPromise) {
      this.jwTokenPromise = this.getJwtFromService()
    }
    return this.jwTokenPromise
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    return {
      Authorization: `JWT ${await this.getJwt()}`,
    }
  }

  public async getSinglePage(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      return await super.getSinglePage({
        ...args,
        headers: {
          ...await this.getAuthHeader(),
          ...(args.headers ?? {}),
        },
      })
    } catch (e) {
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

  public async delete(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return super.delete({
      ...args,
      headers: {
        ...(await this.getAuthHeader()),
        ...(args.headers ?? {}),
      },
    })
  }

  public async put(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return super.put({
      ...args,
      headers: {
        ...(await this.getAuthHeader()),
        ...(args.headers ?? {}),
      },
    })
  }

  public async post(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return super.post({
      ...args,
      headers: {
        ...(await this.getAuthHeader()),
        ...(args.headers ?? {}),
      },
    })
  }
}
