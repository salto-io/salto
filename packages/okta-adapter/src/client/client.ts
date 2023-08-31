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
import { client as clientUtils } from '@salto-io/adapter-components'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import axios from 'axios'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { promises } from '@salto-io/lowerdash'
import { createConnection } from './connection'
import { OKTA } from '../constants'
import { Credentials } from '../auth'
import { LINK_HEADER_NAME } from './pagination'

const { sleep } = promises.timeout
const {
  RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS, DEFAULT_RETRY_OPTS,
  throttle, logDecorator,
} = clientUtils
const log = logger(module)

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<clientUtils.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  // There is a concurrent rate limit of minimum 15, depending on the plan, we take a buffer
  get: 10,
  deploy: 2,
}

// We have a buffer to prevent reaching the rate limit with the initial request on parallel or consecutive fetches
export const RATE_LIMIT_BUFFER = 6 // TODO: make this configurable

// Unlimited because the rate max requests is calculated dynamically
const DEFAULT_MAX_REQUESTS_PER_MINUTE = -1

const DEFAULT_PAGE_SIZE: Required<clientUtils.ClientPageSizeConfig> = {
  get: 50,
}

// The expression match AppUserSchema endpoint used for fetch
const APP_USER_SCHEMA_URL = /(\/api\/v1\/meta\/schemas\/apps\/[a-zA-Z0-9]+\/default)/

const initRateLimits = {
  rateLimitRemaining: 0,
  rateLimitReset: 0,
  currentlyRunning: 0,
}

// According to https://developer.okta.com/docs/reference/rl-global-mgmt/
const rateLimitUrls = [
  new RegExp('/api/v1/apps/.+/(?:logo|groups)'), // has to be before /api/v1/apps.*
  new RegExp('/api/v1/apps.*'),
  new RegExp('/api/v1/groups/.+/roles'), // has to be before /api/v1/groups.*
  new RegExp('/api/v1/groups.*'),
  new RegExp('/api/v1/users.*'),
  new RegExp('/api/v1/users'),
  new RegExp('/api/v1/logs.*'),
  new RegExp('/api/v1/events.*'),
  new RegExp('/api/v1/certificateAuthorities.*'),
  new RegExp('/api/v1/devices.*'),
  new RegExp('/api/v1/org/email/bounces/remove-list'),
  new RegExp('/oauth2/v1/clients.*'),
  new RegExp('/api/v1.*'), // Has to be last
]

const waitForRateLimit = async (rateLimitReset: number): Promise<void> => {
  // Calculate the time to wait until the rate limit is reset and wait
  const currentTime = Date.now()
  const rateLimitResetTime = Math.max(rateLimitReset - currentTime, 100)
  await sleep(rateLimitResetTime)
}

const updateRateLimits = (
  rateLimits: { rateLimitRemaining: number; rateLimitReset: number },
  headers: Record<string, string>
): void => {
  const updatedRateLimitRemaining = Number(headers['x-rate-limit-remaining'])
  const updatedRateLimitReset = Number(headers['x-rate-limit-reset'])
  if (!_.isNumber(updatedRateLimitRemaining) || !_.isNumber(updatedRateLimitReset)) {
    log.error(`Invalid getSinglePage response headers, remaining: ${updatedRateLimitRemaining}, reset: ${updatedRateLimitReset}`)
    return
  }
  // If this is a new limitation, reset the remaining count
  if (updatedRateLimitReset !== rateLimits.rateLimitReset) {
    rateLimits.rateLimitRemaining = updatedRateLimitRemaining
    rateLimits.rateLimitReset = updatedRateLimitReset * 1000 // Convert to milliseconds
  } else {
    // In case an older request returned after a newer one, we want to take the minimum because it is the most updated
    rateLimits.rateLimitRemaining = Math.min(updatedRateLimitRemaining, rateLimits.rateLimitRemaining)
  }
}

export default class OktaClient extends clientUtils.AdapterHTTPClient<
  Credentials, clientUtils.ClientRateLimitConfig
> {
  private rateLimits = rateLimitUrls.map(url => ({
    url,
    limits: { ...initRateLimits },
  }))

  private defaultRateLimit = { ...initRateLimits } // All other endpoints share the same rate limit

  constructor(
    clientOpts: clientUtils.ClientOpts<Credentials, clientUtils.ClientRateLimitConfig>
  ) {
    super(
      OKTA,
      clientOpts,
      createConnection,
      {
        pageSize: DEFAULT_PAGE_SIZE,
        rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
        maxRequestsPerMinute: DEFAULT_MAX_REQUESTS_PER_MINUTE,
        retry: DEFAULT_RETRY_OPTS,
      }
    )
  }

  public get baseUrl(): string {
    return this.credentials.baseUrl
  }

  // This getSinglePage tracks the number of running requests per endpoint, with their rate limits and reset times
  // It Pauses new requests when running requests approach the rate limit, factoring in a buffer
  // Then it resumes when the rate limit resets.
  // For more information: SALTO-4350
  public async getSinglePage(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    const rateLimits = this.rateLimits.find(rateLimit => args.url.match(rateLimit.url))?.limits ?? this.defaultRateLimit
    // If this is the initial request, don't wait
    if (!_.isEqual(rateLimits, initRateLimits)
      // If nothing is running, and we passed the rate limit reset time, don't wait
      && !(rateLimits.currentlyRunning === 0 && rateLimits.rateLimitReset < Date.now())
      // If we are at the rate limit with the buffer, wait
      && rateLimits.rateLimitRemaining - rateLimits.currentlyRunning <= RATE_LIMIT_BUFFER) {
      await waitForRateLimit(rateLimits.rateLimitReset)
      return this.getSinglePage(args)
    }
    let headers: Record<string, string> | undefined
    try {
      rateLimits.currentlyRunning += 1
      const res = await super.getSinglePage(args)
      headers = res.headers
      return res
    } catch (e) {
      headers = e.response?.headers
      const status = e.response?.status
      // Okta returns 404 when trying fetch AppUserSchema for built-in apps
      if (status === 404 && args.url.match(APP_USER_SCHEMA_URL)) {
        log.debug('Suppressing %d error %o for AppUserSchema', status, e)
        return { data: [], status }
      }
      // Okta returns 410 for deprecated endpoints
      if (status === 410) {
        log.warn('Suppressing %d error %o for endpoint: %s', status, e, args.url)
        return { data: [], status }
      }
      throw e
    } finally {
      // Make sure to always decrease the counter and update the headers
      rateLimits.currentlyRunning -= 1
      if (headers) {
        updateRateLimits(rateLimits, headers)
      }
    }
  }

  /**
  * Clear response data values might contain secrets, returns a new object
  */
  // eslint-disable-next-line class-methods-use-this
  protected clearValuesFromResponseData(
    responseData: Values,
    url: string
  ): Values {
    const SECRET_PLACEHOLER = '<SECRET>'
    const URL_TO_SECRET_FIELDS: Record<string, string[]> = {
      '/api/v1/idps': ['credentials'],
      '/api/v1/authenticators': ['sharedSecret', 'secretKey'],
    }
    if (!Object.keys(URL_TO_SECRET_FIELDS).includes(url)) {
      return responseData
    }
    const res = _.cloneDeepWith(responseData, (_val, key) => (
      (_.isString(key) && URL_TO_SECRET_FIELDS[url].includes(key))
        ? SECRET_PLACEHOLER
        : undefined
    ))
    return res
  }

  /**
   * Extract the pagination header
   */
  // eslint-disable-next-line class-methods-use-this
  protected extractHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
    return headers !== undefined
      ? {
        ...super.extractHeaders(headers),
        ..._.pickBy(headers, (_val, key) => key.toLowerCase() === LINK_HEADER_NAME),
      }
      : undefined
  }

  @throttle<clientUtils.ClientRateLimitConfig>({ bucketName: 'get', keys: ['url'] })
  @logDecorator(['url'])
  // We use this function without client instance because we don't need it
  // but we want to take advantage of the client's capabilities.
  // eslint-disable-next-line class-methods-use-this
  public async getResource(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      const { url, responseType } = args
      const httpClient = axios.create({ url })
      const response = await httpClient.get(url, { responseType })
      const { data, status } = response
      log.debug('Received response for resource request %s with status %d', url, status)
      log.trace('Full HTTP response for resource %s: %s', url, safeJsonStringify({
        url, response: data,
      }))
      return {
        data,
        status,
      }
    } catch (e) {
      log.warn('Failed to get response from resource: %s. error %o', args.url, e)
      throw e
    }
  }
}
