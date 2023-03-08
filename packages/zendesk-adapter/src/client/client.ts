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
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api'
import { createConnection, createResourceConnection, instanceUrl } from './connection'
import { ZENDESK } from '../constants'
import { Credentials } from '../auth'
import { PAGE_SIZE } from '../config'

const {
  DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  throttle, logDecorator, requiresLogin,
} = clientUtils
const log = logger(module)

const ORG_ENDPOINT_TO_FILTER = 'organizations/'
const OMIT_REPLACEMENT = '<OMITTED>'

type LogsFilterConfig = {
  allowOrganizationNames?: boolean
}


const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<clientUtils.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  // this is arbitrary, could not find official limits
  get: 100,
  deploy: 100,
}

const DEFAULT_PAGE_SIZE: Required<clientUtils.ClientPageSizeConfig> = {
  get: PAGE_SIZE,
}

const DEFAULT_FILTER_LOGS_CONFIG: LogsFilterConfig = {
  // It is safer to default filter out organization names
  allowOrganizationNames: false,
}


export default class ZendeskClient extends clientUtils.AdapterHTTPClient<
  Credentials, clientUtils.ClientRateLimitConfig
  > {
  // These properties create another connection and client for Zendesk resources API
  protected readonly resourceConn: clientUtils.Connection<Credentials>
  protected isResourceApiLoggedIn = false
  protected resourceLoginPromise?: Promise<clientUtils.APIConnection>
  protected resourceClient?: clientUtils.APIConnection<clientUtils.ResponseValue | clientUtils.ResponseValue[]>
  private logsFilterConfig: LogsFilterConfig

  constructor(
    clientOpts: clientUtils.ClientOpts<Credentials, clientUtils.ClientRateLimitConfig> & LogsFilterConfig,
  ) {
    super(
      ZENDESK,
      clientOpts,
      createConnection,
      {
        pageSize: DEFAULT_PAGE_SIZE,
        rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
        maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
        // These statuses are returned by Zendesk and are not related to our data, a retry should solve them
        retry: Object.assign(DEFAULT_RETRY_OPTS, { additionalStatusCodesToRetry: [409, 503] }),
      },
    )
    this.resourceConn = clientUtils.createClientConnection({
      retryOptions: clientUtils.createRetryOptions(
        _.defaults({}, this.config?.retry, DEFAULT_RETRY_OPTS)
      ),
      createConnection: createResourceConnection,
    })
    this.logsFilterConfig = { ...DEFAULT_FILTER_LOGS_CONFIG, allowOrganizationNames: clientOpts.allowOrganizationNames }
  }

  public getUrl(): URL {
    return new URL(instanceUrl(this.credentials.subdomain, this.credentials.domain))
  }

  public async getSinglePage(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      return await super.getSinglePage(args)
    } catch (e) {
      const status = e.response?.status
      // Zendesk returns 404 when it doesn't have permissions for objects (not enabled features)
      // Specifically for workspaces and custom statuses, it returns 403
      if (status === 404) {
        log.warn('Suppressing %d error %o', status, e)
        return { data: [], status }
      }
      throw e
    }
  }

  public async ensureLoggedIn(): Promise<void> {
    await super.ensureLoggedIn()
    if (!this.isResourceApiLoggedIn) {
      if (this.resourceLoginPromise === undefined) {
        this.resourceLoginPromise = this.resourceConn.login(this.credentials)
      }
      const resourceClient = await this.resourceLoginPromise
      if (this.resourceClient === undefined) {
        this.resourceClient = resourceClient
        this.isResourceApiLoggedIn = true
      }
    }
  }

  @throttle<clientUtils.ClientRateLimitConfig>({ bucketName: 'get', keys: ['url'] })
  @logDecorator(['url'])
  @requiresLogin()
  public async getResource(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    if (this.resourceClient === undefined) {
      // initialized by requiresLogin (through ensureLoggedIn in this case)
      throw new Error(`uninitialized ${this.clientName} resource client`)
    }
    try {
      const { url, headers, responseType } = args
      const requestConfig = [headers, responseType].some(values.isDefined)
        ? {
          headers,
          responseType,
        }
        : undefined
      const { data, status } = await this.resourceClient.get(url, requestConfig)
      log.debug('Received response for resource request %s with status %d', url, status)
      log.trace('Full HTTP response for resource %s: %s', url, safeJsonStringify({
        url, response: data,
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

  protected clearValuesFromResponseData(
    responseData: Values,
    url: string
  ): Values {
    const cloneResponseData = _.cloneDeep(responseData)
    if (!this.logsFilterConfig.allowOrganizationNames && url.includes(ORG_ENDPOINT_TO_FILTER)) {
      cloneResponseData.organizations?.forEach((org: Values) => { org.name = OMIT_REPLACEMENT })
    }
    return cloneResponseData
  }
}
