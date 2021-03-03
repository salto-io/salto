/*
*                      Copyright 2021 Salto Labs Ltd.
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
import Bottleneck from 'bottleneck'
import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import axios from 'axios'
import Ajv from 'ajv'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { Credentials } from '../credentials'
import { HttpMethod, isError, RestletOperation, RestletResults, RESTLET_RESULTS_SCHEMA,
  SavedSearchQuery, SavedSearchResults, SAVED_SEARCH_RESULTS_SCHEMA, SuiteAppClientParameters,
  SuiteQLResults, SUITE_QL_RESULTS_SCHEMA, SystemInformation, SYSTEM_INFORMATION_SCHEME } from './types'


const CONSUMER_KEY = '3db2f2ec0bd98c4eee526ea0b8da876d1d739597e50ee593c67c0f2c34294073'
const CONSUMER_SECRET = '4c8399c03043f4ff2889610d260fc76037d126c840f83b3e6a4e6f4ddf3b0b79'
const PAGE_SIZE = 1000

const log = logger(module)

export class SuiteAppClient {
  private credentials: Credentials
  private callsLimiter: Bottleneck
  private suiteQLUrl: URL
  private restletUrl: URL
  private ajv: Ajv

  constructor(params: SuiteAppClientParameters) {
    this.credentials = params.credentials
    this.callsLimiter = params.callsLimiter

    const accountIdUrl = params.credentials.accountId.replace('_', '-')
    this.suiteQLUrl = new URL(`https://${accountIdUrl}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`)
    this.restletUrl = new URL(`https://${accountIdUrl}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet`)

    this.ajv = new Ajv({ allErrors: true, strict: false })
  }

  public async runSuiteQL(query: string):
    Promise<Record<string, unknown>[] | undefined> {
    let hasMore = true
    const items: Record<string, unknown>[] = []
    for (let offset = 0; hasMore; offset += PAGE_SIZE) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const results = await this.sendSuiteQLRequest(query, offset, PAGE_SIZE)
        // For some reason, a "links" field with empty array is returned regardless
        // to the SELECT values in the query.
        items.push(...results.items.map(item => _.omit(item, ['links'])))
        hasMore = results.hasMore
      } catch (error) {
        log.error('SuiteQL query error', { error })
        return undefined
      }
    }
    return items
  }

  public async runSavedSearchQuery(query: SavedSearchQuery):
    Promise<Record<string, unknown>[] | undefined> {
    let hasMore = true
    const items: Record<string, unknown>[] = []
    for (let offset = 0; hasMore; offset += PAGE_SIZE) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const results = await this.sendSavedSearchRequest(query, offset, PAGE_SIZE)
        items.push(...results)
        hasMore = results.length === PAGE_SIZE
      } catch (error) {
        log.error('Saved search query error', { error })
        return undefined
      }
    }
    return items
  }

  public async getSystemInformation(): Promise<SystemInformation | undefined> {
    try {
      const results = await this.sendRestletRequest('sysInfo')

      if (!this.ajv.validate<{ time: number; appVersion: number[] }>(
        SYSTEM_INFORMATION_SCHEME,
        results
      )) {
        log.error(`getSystemInformation failed. Got invalid results: ${this.ajv.errorsText()}`)
        return undefined
      }

      return { ...results, time: new Date(results.time) }
    } catch (error) {
      log.error('error was thrown in getSystemInformation', { error })
      return undefined
    }
  }

  private async sendSuiteQLRequest(query: string, offset: number, limit: number):
  Promise<SuiteQLResults> {
    const url = new URL(this.suiteQLUrl.href)
    url.searchParams.append('limit', limit.toString())
    url.searchParams.append('offset', offset.toString())

    const headers = {
      ...this.generateHeaders(url, 'POST'),
      prefer: 'transient',
    }
    const response = await this.callsLimiter.schedule(() => axios.post(
      url.href,
      { q: query },
      { headers },
    ))

    if (!this.ajv.validate<SuiteQLResults>(SUITE_QL_RESULTS_SCHEMA, response.data)) {
      throw new Error(`Got invalid results from the SuiteQL query: ${this.ajv.errorsText()}`)
    }

    return response.data
  }

  private async sendRestletRequest(
    operation: RestletOperation,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    const response = await this.callsLimiter.schedule(() => axios.post(
      this.restletUrl.href,
      {
        operation,
        args,
      },
      { headers: this.generateHeaders(this.restletUrl, 'POST') },
    ))

    if (!this.ajv.validate<RestletResults>(RESTLET_RESULTS_SCHEMA, response.data)) {
      throw new Error(`Got invalid results from a Restlet request: ${this.ajv.errorsText()}`)
    }

    if (isError(response.data)) {
      throw new Error(`Restlet request failed. Message: ${response.data.message}, error: ${safeJsonStringify(response.data.error)}`)
    }

    return response.data.results
  }

  private async sendSavedSearchRequest(query: SavedSearchQuery, offset: number, limit: number):
  Promise<SavedSearchResults> {
    const results = await this.sendRestletRequest('search', {
      ...query,
      offset,
      limit,
    })

    if (!this.ajv.validate<SavedSearchResults>(SAVED_SEARCH_RESULTS_SCHEMA, results)) {
      throw new Error(`Got invalid results from the saved search query: ${this.ajv.errorsText()}`)
    }

    return results
  }

  private generateHeaders(url: URL, method: HttpMethod): Record<string, string> {
    return {
      ...this.generateAuthHeader(url, method),
      'Content-Type': 'application/json',
    }
  }

  private generateAuthHeader(url: URL, method: HttpMethod): OAuth.Header {
    const oauth = new OAuth({
      consumer: {
        key: CONSUMER_KEY,
        secret: CONSUMER_SECRET,
      },
      realm: this.credentials.accountId,
      // eslint-disable-next-line @typescript-eslint/camelcase
      signature_method: 'HMAC-SHA256',
      // eslint-disable-next-line @typescript-eslint/camelcase
      hash_function(base_string, key) {
        return crypto.createHmac('sha256', key).update(base_string).digest('base64')
      },
    })

    const requestData = {
      url: url.href,
      method,
    }

    const token = {
      key: this.credentials.tokenId,
      secret: this.credentials.tokenSecret,
    }

    return oauth.toHeader(oauth.authorize(requestData, token))
  }
}
