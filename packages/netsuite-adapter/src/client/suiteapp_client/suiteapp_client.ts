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
import { WSDL } from 'soap'
import { CallsLimiter, ExistingFileCabinetInstanceDetails, FileCabinetInstanceDetails,
  FILES_READ_SCHEMA, HttpMethod, isError, ReadResults, RestletOperation, RestletResults,
  RESTLET_RESULTS_SCHEMA, SavedSearchQuery, SavedSearchResults, SAVED_SEARCH_RESULTS_SCHEMA,
  SuiteAppClientParameters, SuiteQLResults, SUITE_QL_RESULTS_SCHEMA, SystemInformation,
  SYSTEM_INFORMATION_SCHEME } from './types'
import { SuiteAppCredentials, toUrlAccountId } from '../credentials'
import { DEFAULT_CONCURRENCY } from '../../config'
import { CONSUMER_KEY, CONSUMER_SECRET } from './constants'
import SoapClient from './soap_client/soap_client'
import { ReadFileEncodingError, ReadFileError } from './errors'

const PAGE_SIZE = 1000

const log = logger(module)

const NON_BINARY_FILETYPES = new Set([
  'CSV',
  'HTMLDOC',
  'JAVASCRIPT',
  'MESSAGERFC',
  'PLAINTEXT',
  'POSTSCRIPT',
  'RTF',
  'SMS',
  'STYLESHEET',
  'XMLDOC',
])


export default class SuiteAppClient {
  private credentials: SuiteAppCredentials
  private callsLimiter: CallsLimiter
  private suiteQLUrl: URL
  private restletUrl: URL
  private ajv: Ajv
  private soapClient: SoapClient

  constructor(params: SuiteAppClientParameters) {
    this.credentials = params.credentials

    const limiter = new Bottleneck({
      maxConcurrent: params.config?.suiteAppConcurrencyLimit ?? DEFAULT_CONCURRENCY,
    })
    this.callsLimiter = fn => params.globalLimiter.schedule(() => limiter.schedule(fn))

    const accountIdUrl = toUrlAccountId(params.credentials.accountId)
    this.suiteQLUrl = new URL(`https://${accountIdUrl}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`)
    this.restletUrl = new URL(`https://${accountIdUrl}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet`)

    this.ajv = new Ajv({ allErrors: true, strict: false })
    this.soapClient = new SoapClient(this.credentials, this.callsLimiter)
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

  public async readFiles(ids: number[]): Promise<(Buffer | Error)[] | undefined> {
    try {
      const results = await this.sendRestletRequest('readFile', { ids })

      if (!this.ajv.validate<ReadResults>(
        FILES_READ_SCHEMA,
        results
      )) {
        log.error(`readFiles failed. Got invalid results: ${this.ajv.errorsText()}`)
        return undefined
      }

      return results.map(file => {
        if (file.status === 'error') {
          if (file.error.name === 'INVALID_FILE_ENCODING') {
            return new ReadFileEncodingError(`Received file encoding error: ${JSON.stringify(file.error, undefined, 2)}`)
          }
          log.warn(`Received file read error: ${JSON.stringify(file.error, undefined, 2)}`)
          return new ReadFileError(`Received an error while tried to read file: ${JSON.stringify(file.error, undefined, 2)}`)
        }
        return NON_BINARY_FILETYPES.has(file.type) ? Buffer.from(file.content) : Buffer.from(file.content, 'base64')
      })
    } catch (error) {
      log.error('error was thrown in readFiles', { error })
      return undefined
    }
  }

  public static async validateCredentials(credentials: SuiteAppCredentials): Promise<void> {
    const client = new SuiteAppClient({ credentials, globalLimiter: new Bottleneck() })
    await client.sendRestletRequest('sysInfo')
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
    const response = await this.callsLimiter(() => axios.post(
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
    const response = await this.callsLimiter(() => axios.post(
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
      // eslint-disable-next-line camelcase
      signature_method: 'HMAC-SHA256',
      // eslint-disable-next-line camelcase
      hash_function(base_string, key) {
        return crypto.createHmac('sha256', key).update(base_string).digest('base64')
      },
    })

    const requestData = {
      url: url.href,
      method,
    }

    const token = {
      key: this.credentials.suiteAppTokenId,
      secret: this.credentials.suiteAppTokenSecret,
    }

    return oauth.toHeader(oauth.authorize(requestData, token))
  }

  // This function should be used for files which are bigger than 10 mb,
  // otherwise readFiles should be used
  public async readLargeFile(id: number): Promise<Buffer | Error> {
    try {
      return await this.soapClient.readFile(id)
    } catch (e) {
      return e
    }
  }

  public async updateFileCabinetInstances(fileCabinetInstances:
    ExistingFileCabinetInstanceDetails[]): Promise<(number | Error)[]> {
    return this.soapClient.updateFileCabinetInstances(fileCabinetInstances)
  }

  public async addFileCabinetInstances(fileCabinetInstances:
    (FileCabinetInstanceDetails)[]): Promise<(number | Error)[]> {
    return this.soapClient.addFileCabinetInstances(fileCabinetInstances)
  }

  public async deleteFileCabinetInstances(fileCabinetInstances:
    ExistingFileCabinetInstanceDetails[]): Promise<(number | Error)[]> {
    return this.soapClient.deleteFileCabinetInstances(fileCabinetInstances)
  }

  public async getNetsuiteWsdl(): Promise<WSDL> {
    return this.soapClient.getNetsuiteWsdl()
  }
}
