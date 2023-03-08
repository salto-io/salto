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
import { createConnection } from './connection'
import { OKTA } from '../constants'
import { Credentials } from '../auth'
import { LINK_HEADER_NAME } from './pagination'

const {
  RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS, DEFAULT_RETRY_OPTS,
} = clientUtils

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<clientUtils.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  // TODO SALTO-2649: add better handling for rate limits
  get: 2,
  deploy: 2,
}
const DEFAULT_MAX_REQUESTS_PER_MINUTE = 700

const DEFAULT_PAGE_SIZE: Required<clientUtils.ClientPageSizeConfig> = {
  get: 50,
}

export default class OktaClient extends clientUtils.AdapterHTTPClient<
  Credentials, clientUtils.ClientRateLimitConfig
> {
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
        // TODO SALTO-2649: add better handling for rate limits
        maxRequestsPerMinute: DEFAULT_MAX_REQUESTS_PER_MINUTE,
        // wait for 10s before trying again, change after SALTO-2649
        retry: { ...DEFAULT_RETRY_OPTS, retryDelay: 10000 },
      }
    )
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
}
