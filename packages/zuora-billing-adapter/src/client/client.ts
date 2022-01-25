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
import { client as clientUtils } from '@salto-io/adapter-components'
import { createConnection } from './connection'
import { ZUORA_BILLING } from '../constants'
import { Credentials } from '../auth'

const {
  DEFAULT_RETRY_OPTS, RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
} = clientUtils

// https://knowledgecenter.zuora.com/BB_Introducing_Z_Business/Policies/Concurrent_Request_Limits#Rate_limits
const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<clientUtils.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  get: 15, // can increase, max is 20 / 40 depending on specific request
  deploy: 15,
}

const DEFAULT_PAGE_SIZE: Required<clientUtils.ClientPageSizeConfig> = {
  get: 100,
}

export default class ZuoraClient extends clientUtils.AdapterHTTPClient<
  Credentials, clientUtils.ClientRateLimitConfig
> {
  constructor(
    clientOpts: clientUtils.ClientOpts<Credentials, clientUtils.ClientRateLimitConfig>,
  ) {
    super(
      ZUORA_BILLING,
      clientOpts,
      createConnection,
      {
        pageSize: DEFAULT_PAGE_SIZE,
        rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
        retry: DEFAULT_RETRY_OPTS,
      }
    )
  }
}
