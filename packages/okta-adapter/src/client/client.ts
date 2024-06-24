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
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import { Values } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import axios from 'axios'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { promises } from '@salto-io/lowerdash'
import { createConnection } from './connection'
import { OKTA } from '../constants'
import { Credentials } from '../auth'
import { LINK_HEADER_NAME } from './pagination'
import { OktaClientRateLimitConfig } from '../user_config'

const { sleep } = promises.timeout
const {
  RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  DEFAULT_RETRY_OPTS,
  DEFAULT_TIMEOUT_OPTS,
  throttle,
  logDecorator,
} = clientUtils
const log = logger(module)

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<definitions.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  // the smallest concurrent rate limit is 15 (by plan)
  get: 15,
  deploy: 10,
}

// We have a buffer to prevent reaching the rate limit with the initial request on parallel or consecutive fetches
export const DEFAULT_RATE_LIMIT_BUFFER = 6

// This is the most common rate limit according to https://developer.okta.com/docs/reference/rl-global-mgmt/
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 600
export const UNLIMITED_MAX_REQUESTS_PER_MINUTE = -1

const DEFAULT_PAGE_SIZE: Required<definitions.ClientPageSizeConfig> = {
  get: 50,
}

// The expression match AppUserSchema endpoint used for fetch
const APP_USER_SCHEMA_URL = /(\/api\/v1\/meta\/schemas\/apps\/[a-zA-Z0-9]+\/default)/

type OktaRateLimits = {
  rateLimitRemaining: number
  rateLimitReset: number
  currentlyRunning: number
  maxPerMinute: number
}

const INIT_RATE_LIMITS: OktaRateLimits = {
  rateLimitRemaining: 0,
  rateLimitReset: 0,
  currentlyRunning: 0,
  maxPerMinute: 0,
}

// according to okta, the way to tell if it is an id is that includes both letters and numbers
// this regex makes sure there is at least 1 letter and at least 1 number, and no slashes
const ID_REGEX = '(?=.*[a-zA-Z])(?=.*\\d)(?!.*\\/).+'
// According to https://developer.okta.com/docs/reference/rl-global-mgmt/
const RATE_LIMIT_BUCKETS = [
  new RegExp(`^/api/v1/apps/${ID_REGEX}$`), // has to be before /api/v1/apps.*
  new RegExp('^/api/v1/apps.*'),
  new RegExp(`^/api/v1/groups/${ID_REGEX}$`), // has to be before /api/v1/groups.*
  new RegExp('^/api/v1/groups.*'),
  new RegExp('^/api/v1/users.*'),
  new RegExp('^/api/v1/users'),
  new RegExp('^/api/v1/logs.*'),
  new RegExp('^/api/v1/events.*'),
  new RegExp('^/api/v1/certificateAuthorities.*'),
  new RegExp('^/api/v1/devices.*'),
  new RegExp('^/api/v1/org/email/bounces/remove-list'),
  new RegExp('^/oauth2/v1/clients.*'),
  /* these endpoints are not documented, but have their own rate limit */
  new RegExp('^/api/v1/iam.*'),
  new RegExp('^/api/v1/domains'),
  new RegExp('^/api/v1/device-assurances'),
  new RegExp('^/api/internal/orgSettings/thirdPartyAdminSetting'),
  /**/
  new RegExp('^/api/v1.*'), // Has to be last
]

export const waitForRateLimit = async (rateLimitReset: number, url: string): Promise<void> => {
  // Calculate the time to wait until the rate limit is reset and wait
  const currentTime = Date.now()
  const rateLimitResetTime = Math.max(rateLimitReset - currentTime, 1000)
  log.debug(`Waiting ${rateLimitResetTime}ms until rate limit is reset for ${url}`)
  await sleep(rateLimitResetTime)
}

const shouldRunRequest = (rateLimits: OktaRateLimits, rateLimitBuffer: number): boolean => {
  const isRateLimitDisabled = rateLimitBuffer === UNLIMITED_MAX_REQUESTS_PER_MINUTE
  const isInitialRequest = _.isEqual(rateLimits, INIT_RATE_LIMITS)
  const isWithinRateLimitBuffer = rateLimits.rateLimitRemaining - rateLimits.currentlyRunning > rateLimitBuffer
  const didRateLimitReset = rateLimits.rateLimitReset + 1000 < Date.now() // buffer in case the limit is round down
  const isRateLimitResetSet = rateLimits.rateLimitReset !== INIT_RATE_LIMITS.rateLimitReset
  const isMaxPerMinuteReached = rateLimits.currentlyRunning >= rateLimits.maxPerMinute - rateLimitBuffer

  return (
    isRateLimitDisabled ||
    isInitialRequest ||
    isWithinRateLimitBuffer ||
    (didRateLimitReset &&
      isRateLimitResetSet && // We need to make sure we have a valid reset time
      !isMaxPerMinuteReached) // In case there were more waiting than the max per minute, we need this safety
  )
}
export const updateRateLimits = (rateLimits: OktaRateLimits, headers: Record<string, string>, url: string): void => {
  const updatedRateLimitRemaining = Number(headers['x-rate-limit-remaining'])
  const updatedRateLimitReset = Number(headers['x-rate-limit-reset'])
  const updateMaxPerMinute = Number(headers['x-rate-limit-limit'])
  if (!_.isFinite(updatedRateLimitRemaining) || !_.isFinite(updatedRateLimitReset) || !_.isFinite(updateMaxPerMinute)) {
    log.warn(
      `Invalid get response headers for url: ${url}, remaining: ${updatedRateLimitRemaining}, reset: ${updatedRateLimitReset}`,
    )
    return
  }
  // If this is a new limitation, reset the remaining count
  if (updatedRateLimitReset * 1000 !== rateLimits.rateLimitReset) {
    rateLimits.rateLimitRemaining = updatedRateLimitRemaining
    rateLimits.rateLimitReset = updatedRateLimitReset * 1000 // Convert to milliseconds
  } else {
    // In case an older request returned after a newer one, we want to take the minimum because it is the most updated
    rateLimits.rateLimitRemaining = Math.min(updatedRateLimitRemaining, rateLimits.rateLimitRemaining)
  }
  rateLimits.maxPerMinute = updateMaxPerMinute
}

export default class OktaClient extends clientUtils.AdapterHTTPClient<Credentials, definitions.ClientRateLimitConfig> {
  private readonly rateLimitBuffer: number

  private rateLimits = RATE_LIMIT_BUCKETS.map(url => ({
    url,
    limits: { ...INIT_RATE_LIMITS },
  }))

  private defaultRateLimits = { ...INIT_RATE_LIMITS } // All other endpoints share the same rate limit

  constructor(clientOpts: clientUtils.ClientOpts<Credentials, OktaClientRateLimitConfig>) {
    super(OKTA, clientOpts, createConnection, {
      pageSize: DEFAULT_PAGE_SIZE,
      rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
      maxRequestsPerMinute:
        clientOpts.config?.rateLimit?.rateLimitBuffer === UNLIMITED_MAX_REQUESTS_PER_MINUTE
          ? DEFAULT_MAX_REQUESTS_PER_MINUTE // This means the dynamic calculation is disabled, so we use the default
          : UNLIMITED_MAX_REQUESTS_PER_MINUTE, // Unlimited because the rate max requests is calculated dynamically
      retry: DEFAULT_RETRY_OPTS,
      timeout: DEFAULT_TIMEOUT_OPTS,
    })
    this.rateLimitBuffer = clientOpts.config?.rateLimit?.rateLimitBuffer ?? DEFAULT_RATE_LIMIT_BUFFER
  }

  public get baseUrl(): string {
    return this.credentials.baseUrl
  }

  private shouldUseDynamicRateLimit = (): boolean => this.rateLimitBuffer !== UNLIMITED_MAX_REQUESTS_PER_MINUTE

  // This get tracks the number of running requests per endpoint, with their rate limits and reset times
  // It Pauses new requests when running requests approach the rate limit, factoring in a buffer
  // Then it resumes when the rate limit resets.
  // For more information: SALTO-4350
  public async get(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    const rateLimits = this.rateLimits.find(({ url }) => args.url.match(url))?.limits ?? this.defaultRateLimits

    if (this.shouldUseDynamicRateLimit()) {
      while (!shouldRunRequest(rateLimits, this.rateLimitBuffer)) {
        // eslint-disable-next-line no-await-in-loop
        await waitForRateLimit(rateLimits.rateLimitReset, args.url)
      }
    }
    try {
      // when upgrading this adapter to next infra
      // this part will be deleted and should be represented in the client definitions
      rateLimits.currentlyRunning += 1
      const res = await super.get(args)
      if (res.headers && this.shouldUseDynamicRateLimit()) {
        updateRateLimits(rateLimits, res.headers, args.url)
      }
      return res
    } catch (e) {
      if (e.response?.headers && this.shouldUseDynamicRateLimit()) {
        updateRateLimits(rateLimits, e.response?.headers, args.url)
      }
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
      // Make sure to always decrease the counter
      rateLimits.currentlyRunning -= 1
    }
  }

  /**
   * Clear response data values might contain secrets, returns a new object
   */
  // eslint-disable-next-line class-methods-use-this
  protected clearValuesFromResponseData(responseData: Values, url: string): Values {
    const OMITTED_PLACEHOLER = '<OMITTED>'
    const URL_TO_OMIT_FUNC: Record<string, (key: string, val: unknown) => unknown> = {
      '/api/v1/idps': key => (key === 'credentials' ? OMITTED_PLACEHOLER : undefined),
      '/api/v1/authenticators': key => (['sharedSecret', 'secretKey'].includes(key) ? OMITTED_PLACEHOLER : undefined),
      '/api/v1/users': (key, val) => (key === 'profile' && _.isObject(val) ? _.pick(val, 'login') : undefined),
    }
    if (!Object.keys(URL_TO_OMIT_FUNC).includes(url)) {
      return responseData
    }
    const res = _.cloneDeepWith(responseData, (val, key) =>
      _.isString(key) && URL_TO_OMIT_FUNC[url] ? URL_TO_OMIT_FUNC[url](key, val) : undefined,
    )
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

  @throttle<definitions.ClientRateLimitConfig>({ bucketName: 'get', keys: ['url'] })
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
      log.trace(
        'Full HTTP response for GET on %s: %s',
        url,
        safeJsonStringify({
          url,
          status,
          responseType,
          response: Buffer.isBuffer(data) ? `<omitted buffer of length ${data.length}>` : data,
        }),
      )
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
