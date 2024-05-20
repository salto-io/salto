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
import _ from 'lodash'
import { createSchemeGuard, safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { values } from '@salto-io/lowerdash'
import { Values } from '@salto-io/adapter-api'
import Joi from 'joi'
import { createConnection, createResourceConnection, instanceUrl } from './connection'
import { ZENDESK } from '../constants'
import { Credentials } from '../auth'
import { PAGE_SIZE, DEFAULT_TIMEOUT_OPTS } from '../config'

const { DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS, throttle, logDecorator, requiresLogin } =
  clientUtils
const log = logger(module)

const ORG_ENDPOINT_TO_FILTER = 'organizations/'
const OMIT_REPLACEMENT = '<OMITTED>'

type LogsFilterConfig = {
  allowOrganizationNames?: boolean
}

export type HolidayRes = {
  data: {
    holidays: Values[]
  }
}
export type SupportAddressRes = {
  data: {
    // eslint-disable-next-line camelcase
    recipient_addresses: Values[]
  }
}
export type AttachmentRes = {
  data: {
    // eslint-disable-next-line camelcase
    article_attachments: Values[]
  }
}

const getSchema = (field: string): Joi.AnySchema =>
  Joi.object({
    data: Joi.object({
      [field]: Joi.array().items(Joi.object().unknown(true)).required(),
    })
      .unknown(true)
      .required(),
  })
    .unknown(true)
    .required()

const isHolidayResponse = createSchemeGuard<HolidayRes>(getSchema('holidays'))
const isSupportAddressResponse = createSchemeGuard<SupportAddressRes>(getSchema('recipient_addresses'))
const isAttachmentResponse = createSchemeGuard<AttachmentRes>(getSchema('article_attachments'))

const getClientResponseAdjuster = (): ((
  url: string,
  response: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>,
) => clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>) => {
  let holidayCounter = 0
  let usernameCounter = 0
  let attachmentCounter = 0
  return (
    url: string,
    response: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>,
  ): clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]> => {
    // for endpoint /api/v2/business_hours/schedules/{scheduleId}/holidays
    if (url.includes('holidays') && isHolidayResponse(response)) {
      response.data.holidays.forEach(day => {
        day.start_year = holidayCounter
        day.end_year = holidayCounter
        holidayCounter += 1
      })
      // for endpoint /api/v2/recipient_addresses
    } else if (url.includes('recipient_addresses') && isSupportAddressResponse(response)) {
      response.data.recipient_addresses.forEach(email => {
        email.username = usernameCounter
        usernameCounter += 1
      })
      // for endpoint /api/v2/help_center/articles/{article_id}/attachments
    } else if (url.includes('attachments') && url.includes('articles') && isAttachmentResponse(response)) {
      response.data.article_attachments.forEach(attachment => {
        attachment.hash = attachmentCounter
        attachmentCounter += 1
      })
    }
    return response
  }
}

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<definitions.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  // this is arbitrary, could not find official limits
  get: 100,
  deploy: 100,
}

const DEFAULT_PAGE_SIZE: Required<definitions.ClientPageSizeConfig> = {
  get: PAGE_SIZE,
}

const DEFAULT_FILTER_LOGS_CONFIG: LogsFilterConfig = {
  // It is safer to default filter out organization names
  allowOrganizationNames: false,
}

export default class ZendeskClient extends clientUtils.AdapterHTTPClient<
  Credentials,
  definitions.ClientRateLimitConfig
> {
  // These properties create another connection and client for Zendesk resources API
  protected readonly resourceConn: clientUtils.Connection<Credentials>
  protected isResourceApiLoggedIn = false
  protected resourceLoginPromise?: Promise<clientUtils.APIConnection>
  protected resourceClient?: clientUtils.APIConnection<clientUtils.ResponseValue | clientUtils.ResponseValue[]>
  private logsFilterConfig: LogsFilterConfig
  private adjuster: (
    url: string,
    response: clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>,
  ) => clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>

  constructor(clientOpts: clientUtils.ClientOpts<Credentials, definitions.ClientRateLimitConfig> & LogsFilterConfig) {
    super(ZENDESK, clientOpts, createConnection, {
      pageSize: DEFAULT_PAGE_SIZE,
      rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
      maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      // These statuses are returned by Zendesk and are not related to our data, a retry should solve them
      retry: Object.assign(DEFAULT_RETRY_OPTS, { additionalStatusCodesToRetry: [409, 503] }),
      timeout: DEFAULT_TIMEOUT_OPTS,
    })
    this.adjuster = getClientResponseAdjuster()
    this.resourceConn = clientUtils.createClientConnection({
      retryOptions: clientUtils.createRetryOptions(
        _.defaults({}, this.config?.retry, DEFAULT_RETRY_OPTS),
        _.defaults({}, this.config?.timeout, DEFAULT_TIMEOUT_OPTS),
      ),
      createConnection: createResourceConnection,
    })
    this.logsFilterConfig = { ...DEFAULT_FILTER_LOGS_CONFIG, allowOrganizationNames: clientOpts.allowOrganizationNames }
  }

  public getUrl(): URL {
    return new URL(instanceUrl(this.credentials.subdomain, this.credentials.domain))
  }

  public async get(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      // when upgrading this adapter to next infra
      // this part will be deleted and should be represented in the client definitions
      const response = await super.get(args)
      return this.adjuster(args.url, response)
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

  @throttle<definitions.ClientRateLimitConfig>({ bucketName: 'get', keys: ['url'] })
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
      // when upgrading this adapter to next infra
      // this part will be deleted and should be represented in the client definitions
      const { url, headers, responseType } = args
      const requestConfig = [headers, responseType].some(values.isDefined)
        ? {
            headers,
            responseType,
          }
        : undefined
      const { data, status } = await this.resourceClient.get(url, requestConfig)
      log.trace(
        'Full HTTP response for GET on %s: %s',
        url,
        safeJsonStringify({
          url,
          status,
          requestConfig,
          response: Buffer.isBuffer(data) ? `<omitted buffer of length ${data.length}>` : data,
        }),
      )
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

  protected clearValuesFromResponseData(responseData: Values, url: string): Values {
    const cloneResponseData = _.cloneDeep(responseData)
    if (!this.logsFilterConfig.allowOrganizationNames && url.includes(ORG_ENDPOINT_TO_FILTER)) {
      cloneResponseData.organizations?.forEach((org: Values) => {
        org.name = OMIT_REPLACEMENT
      })
    }
    return cloneResponseData
  }
}
