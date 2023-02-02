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
import { handleDeploymentErrors } from '../deployment/deployment_error_handling'
import { createConnection } from './connection'
import { JIRA } from '../constants'
import { Credentials } from '../auth'
import { getProductSettings } from '../product_settings'
import { JSP_API_HEADERS, PRIVATE_API_HEADERS } from './headers'

const log = logger(module)

const {
  DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
} = clientUtils

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<clientUtils.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  get: 20,
  deploy: 2,
}

const DEFAULT_PAGE_SIZE: Required<clientUtils.ClientPageSizeConfig> = {
  get: 50,
}

export default class JiraClient extends clientUtils.AdapterHTTPClient<
  Credentials, clientUtils.ClientRateLimitConfig
> {
  readonly isDataCenter: boolean

  constructor(
    clientOpts: clientUtils.ClientOpts<Credentials, clientUtils.ClientRateLimitConfig>
      & { isDataCenter: boolean },
  ) {
    super(
      JIRA,
      clientOpts,
      createConnection,
      {
        pageSize: DEFAULT_PAGE_SIZE,
        rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
        maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        retry: DEFAULT_RETRY_OPTS,
      }
    )
    this.isDataCenter = clientOpts.isDataCenter
  }

  public get baseUrl(): string {
    return this.credentials.baseUrl
  }

  public async getSinglePage(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      return await super.getSinglePage(args)
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

  protected async ensureLoggedIn(): Promise<void> {
    const wasLoggedIn = this.isLoggedIn
    await super.ensureLoggedIn()
    if (!wasLoggedIn && this.apiClient !== undefined) {
      this.apiClient = getProductSettings({ isDataCenter: this.isDataCenter })
        .wrapConnection(this.apiClient)
    }
  }

  // Sends a post request to a JIRA JSP page
  public async jspPost(
    args: clientUtils.ClientDataParams & { data: Record<string, string> },
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return this.post({
      ...args,
      data: new URLSearchParams(args.data),
      headers: {
        ...JSP_API_HEADERS,
        ...(args.headers ?? {}),
      },
    })
  }

  public async getPrivate(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return this.getSinglePage({
      ...args,
      headers: {
        ...PRIVATE_API_HEADERS,
        ...(args.headers ?? {}),
      },
    })
  }

  public async deletePrivate(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return this.delete({
      ...args,
      headers: {
        ...PRIVATE_API_HEADERS,
        ...(args.headers ?? {}),
      },
    })
  }

  public async putPrivate(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return this.put({
      ...args,
      headers: {
        ...PRIVATE_API_HEADERS,
        ...(args.headers ?? {}),
      },
    })
  }

  public async postPrivate(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return this.post({
      ...args,
      headers: {
        ...PRIVATE_API_HEADERS,
        ...(args.headers ?? {}),
      },
    })
  }

  public async patchPrivate(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return this.patch({
      ...args,
      headers: {
        ...PRIVATE_API_HEADERS,
        ...(args.headers ?? {}),
      },
    })
  }
}
