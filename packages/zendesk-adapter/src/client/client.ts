/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { createConnection, createResourcesConnection, instanceUrl } from './connection'
import { ZENDESK } from '../constants'
import { Credentials } from '../auth'

const { DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  throttle, logDecorator, requiresLogin } = clientUtils
const log = logger(module)

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<clientUtils.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  // this is arbitrary, could not find official limits
  get: 20,
  deploy: 20,
}

const DEFAULT_PAGE_SIZE: Required<clientUtils.ClientPageSizeConfig> = {
  get: 20,
}

export default class ZendeskClient extends clientUtils.AdapterHTTPClient<
  Credentials, clientUtils.ClientRateLimitConfig
> {
  protected readonly resourcesConn: clientUtils.Connection<Credentials> | undefined
  protected isResourcesApiLoggedIn = false
  protected resourceasLoginPromise?: Promise<clientUtils.APIConnection>
  protected resourcesClient: clientUtils.APIConnection<
    clientUtils.ResponseValue | clientUtils.ResponseValue[]
  >
  | undefined

  constructor(
    clientOpts: clientUtils.ClientOpts<Credentials, clientUtils.ClientRateLimitConfig>,
  ) {
    super(
      ZENDESK,
      clientOpts,
      createConnection,
      {
        pageSize: DEFAULT_PAGE_SIZE,
        rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
        retry: DEFAULT_RETRY_OPTS,
      },
    )
    this.resourcesConn = clientUtils.createClientConnection({
      retryOptions: clientUtils.createRetryOptions(
        _.defaults({}, this.config?.retry, DEFAULT_RETRY_OPTS)
      ),
      createConnection: createResourcesConnection,
    })
  }

  public getUrl(): URL {
    return new URL(instanceUrl(this.credentials.subdomain))
  }

  public async getSinglePage(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      return await super.getSinglePage(args)
    } catch (e) {
      const status = e.response?.status
      // Zendesk returns 404 when it doesn't have permissions for objects (not enabled features)
      // Specifically for workspaces, it returns 403
      if (status === 404 || (status === 403 && args.url === '/workspaces')) {
        log.warn('Suppressing %d error %o', status, e)
        return { data: [], status }
      }
      throw e
    }
  }

  public async ensureLoggedIn(): Promise<void> {
    await super.ensureLoggedIn()
    if (!this.isResourcesApiLoggedIn && this.resourcesConn) {
      if (this.resourceasLoginPromise === undefined) {
        this.resourceasLoginPromise = this.resourcesConn.login(this.credentials)
      }
      const resourcesClient = await this.resourceasLoginPromise
      if (this.resourcesClient === undefined) {
        this.resourcesClient = resourcesClient
        this.isResourcesApiLoggedIn = true
      }
    }
  }

  @throttle<clientUtils.ClientRateLimitConfig>({ bucketName: 'get', keys: ['url', 'queryParams'] })
  @logDecorator(['url', 'queryParams'])
  @requiresLogin()
  public async getResource(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    if (this.resourcesClient === undefined) {
      // initialized by requiresLogin (through ensureLoggedIn in this case)
      throw new Error(`uninitialized ${this.clientName} client`)
    }
    try {
      const { url, queryParams, headers, responseType } = args
      const requestConfig = [queryParams, headers, responseType].some(values.isDefined)
        ? {
          params: queryParams,
          headers,
          responseType,
        }
        : undefined
      const { data, status } = await this.resourcesClient.get(url, requestConfig)
      log.debug('Received response for %s (%s) with status %d', url, safeJsonStringify({ url, queryParams }), status)
      log.trace('Full HTTP response for %s: %s', url, safeJsonStringify({
        url, queryParams, response: data,
      }))
      return {
        data,
        status,
      }
    } catch (e) {
      const status = e.response?.status
      if (status === 404) {
        log.warn('Suppressing %d error %o', status, e)
        return { data: [], status }
      }
      throw e
    }
  }
}
