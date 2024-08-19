/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

export const USE_BOTTLENECK = true
export const DELAY_PER_REQUEST_MS = 0

export const GET_CLOUD_ID_URL = '/_edge/tenant_info'
export const GQL_BASE_URL_GIRA = '/rest/gira/1'
export const GQL_BASE_URL_GATEWAY = '/gateway/api/graphql'

export type CloudIdResponseType = {
  cloudId: string
}

const CLOUD_ID_RESPONSE_SCHEME = Joi.object({
  cloudId: Joi.required(),
})
  .unknown(true)
  .required()

const isCloudIdResponse = createSchemeGuard<CloudIdResponseType>(
  CLOUD_ID_RESPONSE_SCHEME,
  'Failed to get cloud id response with the expected format.',
)

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
  private cloudId: Promise<string> | undefined
  constructor(
    clientOpts: clientUtils.ClientOpts<Credentials, definitions.ClientRateLimitConfig> & { isDataCenter: boolean },
  ) {
    super(JIRA, clientOpts, createConnection, {
      pageSize: DEFAULT_PAGE_SIZE,
      rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
      maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      delayPerRequestMS: DELAY_PER_REQUEST_MS,
      useBottleneck: USE_BOTTLENECK,
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

  public async atlassianApiGet(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    const cloudId = await this.getCloudId()
    return this.get({
      ...args,
      url: `https://api.atlassian.com/jira/forms/cloud/${cloudId}/${args.url}`,
    })
  }

  public async atlassianApiPost(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    const cloudId = await this.getCloudId()
    return this.post({
      ...args,
      url: `https://api.atlassian.com/jira/forms/cloud/${cloudId}/${args.url}`,
    })
  }

  public async atlassianApiPut(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    const cloudId = await this.getCloudId()
    return this.put({
      ...args,
      url: `https://api.atlassian.com/jira/forms/cloud/${cloudId}/${args.url}`,
    })
  }

  public async atlassianApiDelete(
    args: clientUtils.ClientDataParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    const cloudId = await this.getCloudId()
    return this.delete({
      ...args,
      url: `https://api.atlassian.com/jira/forms/cloud/${cloudId}/${args.url}`,
    })
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

  private async getCloudIdPromise(): Promise<string> {
    const response = await this.get({
      url: GET_CLOUD_ID_URL,
    })
    if (!isCloudIdResponse(response.data)) {
      this.cloudId = undefined // This invalidates cloudId cache.
      throw new Error(`'Failed to get cloud id, received invalid response' ${response.data}`)
    }
    return response.data.cloudId
  }

  public async getCloudId(): Promise<string> {
    if (this.cloudId === undefined) {
      // Caches result/promise so that future calls await on the same request.
      this.cloudId = this.getCloudIdPromise()
    }
    return this.cloudId
  }
}
