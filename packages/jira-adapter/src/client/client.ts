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
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import Joi from 'joi'
import _ from 'lodash'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import { handleDeploymentErrors } from '../deployment/deployment_error_handling'
import { createConnection } from './connection'
import { JIRA } from '../constants'
import { Credentials } from '../auth'
import { getProductSettings } from '../product_settings'
import { JSP_API_HEADERS, PRIVATE_API_HEADERS } from './headers'

const log = logger(module)

const { DEFAULT_RETRY_OPTS, DEFAULT_TIMEOUT_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS } = clientUtils

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<definitions.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  get: 60,
  deploy: 2,
}

const DEFAULT_PAGE_SIZE: Required<definitions.ClientPageSizeConfig> = {
  get: 1000,
}

const RATE_LIMIT_HEADER_PREFIX = 'x-ratelimit-'

export type graphQLResponseType = {
  data: unknown
  errors?: unknown[]
}

const GRAPHQL_RESPONSE_SCHEME = Joi.object({
  data: Joi.required(),
  errors: Joi.optional(),
})
  .unknown(true)
  .required()

const isGraphQLResponse = createSchemeGuard<graphQLResponseType>(
  GRAPHQL_RESPONSE_SCHEME,
  'Failed to get graphql response',
)

export default class JiraClient extends clientUtils.AdapterHTTPClient<Credentials, definitions.ClientRateLimitConfig> {
  readonly isDataCenter: boolean

  constructor(
    clientOpts: clientUtils.ClientOpts<Credentials, definitions.ClientRateLimitConfig> & { isDataCenter: boolean },
  ) {
    super(JIRA, clientOpts, createConnection, {
      pageSize: DEFAULT_PAGE_SIZE,
      rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
      maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      retry: DEFAULT_RETRY_OPTS,
      timeout: DEFAULT_TIMEOUT_OPTS,
    })
    this.isDataCenter = clientOpts.isDataCenter
  }

  public get baseUrl(): string {
    return this.credentials.baseUrl
  }

  public async get(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      // when upgrading this adapter to next infra
      // this part will be deleted and should be represented in the client definitions
      return await super.get(args)
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
    params: clientUtils.HttpMethodToClientParams[T],
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return super.sendRequest(method, params)
  }

  protected async ensureLoggedIn(): Promise<void> {
    const wasLoggedIn = this.isLoggedIn
    await super.ensureLoggedIn()
    if (!wasLoggedIn && this.apiClient !== undefined) {
      this.apiClient = getProductSettings({ isDataCenter: this.isDataCenter }).wrapConnection(this.apiClient)
    }
  }

  // eslint-disable-next-line class-methods-use-this
  protected extractHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
    const rateLimitHeaders = _.pickBy(headers, (_val, key) => key.toLowerCase().startsWith(RATE_LIMIT_HEADER_PREFIX))
    if (rateLimitHeaders !== undefined && rateLimitHeaders['x-ratelimit-nearlimit']) {
      log.trace('temp performance log, rate limit near limit reached')
    }
    return headers !== undefined
      ? {
          ...super.extractHeaders(headers),
          ...rateLimitHeaders,
        }
      : undefined
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

  // Sends a get request to a JIRA JSP page
  public async jspGet(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return this.get({
      ...args,
      headers: {
        ...JSP_API_HEADERS,
        ...(args.headers ?? {}),
      },
    })
  }

  // Sends a post request to Jira with GQL body
  @clientUtils.throttle<definitions.ClientRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @clientUtils.logDecorator(['url', 'queryParams'])
  @clientUtils.requiresLogin()
  public async gqlPost(args: {
    url: string
    query: string
    variables?: Record<string, unknown>
  }): Promise<graphQLResponseType> {
    const response = await this.sendRequest('post', {
      url: args.url,
      data: {
        query: args.query,
        variables: args.variables,
      },
      headers: PRIVATE_API_HEADERS,
    })
    if (isGraphQLResponse(response.data)) {
      if (response.data.errors !== undefined && response.data.errors.length > 0) {
        log.warn(
          'received the following errors for POST on %s with query: (%s). errors: %o',
          args.url,
          safeJsonStringify(args.query),
          response.data.errors,
        )
      }
      return response.data
    }
    throw new Error('Failed to get GQL response')
  }

  public async getPrivate(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    return this.get({
      ...args,
      headers: {
        ...PRIVATE_API_HEADERS,
        ...(args.headers ?? {}),
      },
    })
  }

  public async deletePrivate(
    args: clientUtils.ClientDataParams,
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
