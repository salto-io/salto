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
import Bottleneck from 'bottleneck'
import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import axios, { AxiosInstance, AxiosResponse } from 'axios'
import axiosRetry from 'axios-retry'
import Ajv from 'ajv'
import AsyncLock from 'async-lock'
import compareVersions from 'compare-versions'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { values } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils } from '@salto-io/adapter-components'
import { WSDL } from 'soap'
import { InstanceElement } from '@salto-io/adapter-api'
import { CallsLimiter, ConfigRecord, ConfigRecordData, GetConfigResult, CONFIG_RECORD_DATA_SCHEMA,
  GET_CONFIG_RESULT_SCHEMA, ExistingFileCabinetInstanceDetails,
  FILES_READ_SCHEMA, HttpMethod, isError, ReadResults, RestletOperation, RestletResults,
  RESTLET_RESULTS_SCHEMA, SavedSearchQuery, SavedSearchResults, SAVED_SEARCH_RESULTS_SCHEMA,
  SuiteAppClientParameters, SuiteQLResults, SUITE_QL_RESULTS_SCHEMA, SystemInformation,
  SYSTEM_INFORMATION_SCHEME, FileCabinetInstanceDetails, ConfigFieldDefinition, CONFIG_FIELD_DEFINITION_SCHEMA, SetConfigType, SET_CONFIG_RESULT_SCHEMA, SetConfigRecordsValuesResult, SetConfigResult } from './types'
import { SuiteAppCredentials, toUrlAccountId } from '../credentials'
import { CONFIG_RECORD_TYPES } from '../../types'
import { DEFAULT_CONCURRENCY } from '../../config'
import { CONSUMER_KEY, CONSUMER_SECRET } from './constants'
import SoapClient from './soap_client/soap_client'
import { ReadFileEncodingError, ReadFileError, ReadFileInsufficientPermissionError } from './errors'
import { InvalidSuiteAppCredentialsError } from '../types'

const { isDefined } = values
const { DEFAULT_RETRY_OPTS, createRetryOptions } = clientUtils

export const PAGE_SIZE = 1000

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

const UNAUTHORIZED_STATUSES = [401, 403]

const ACTIVATION_KEY_APP_VERSION = '0.1.3'
const CONFIG_TYPES_APP_VERSION = '0.1.4'

type VersionFeatures = {
  activationKey: boolean
  configTypes: boolean
}

export default class SuiteAppClient {
  private credentials: SuiteAppCredentials
  private callsLimiter: CallsLimiter
  private suiteQLUrl: URL
  private restletUrl: URL
  private ajv: Ajv
  private soapClient: SoapClient
  private axiosClient: AxiosInstance

  private versionFeatures: VersionFeatures | undefined
  private readonly setVersionFeaturesLock: AsyncLock

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

    this.axiosClient = axios.create()
    axiosRetry(this.axiosClient, createRetryOptions(DEFAULT_RETRY_OPTS))

    this.versionFeatures = undefined
    this.setVersionFeaturesLock = new AsyncLock()
  }

  /**
   * WARNING:
   * Due to a bug in NetSuite SuiteQL, make sure to use
   * ORDER BY <some unique identifier> ASC/DESC in your queries.
   * Otherwise, you might not get all the results.
   */
  public async runSuiteQL(query: string):
    Promise<Record<string, unknown>[] | undefined> {
    log.debug('Running SuiteQL query: %s', query)
    if (!/ORDER BY .* (ASC|DESC)/.test(query)) {
      log.warn(`SuiteQL ${query} does not contain ORDER BY <unique identifier> ASC/DESC, which can cause the response to not contain all the results`)
    }
    let hasMore = true
    const items: Record<string, unknown>[] = []
    for (let offset = 0; hasMore; offset += PAGE_SIZE) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const results = await this.sendSuiteQLRequest(query, offset, PAGE_SIZE)
        // For some reason, a "links" field with empty array is returned regardless
        // to the SELECT values in the query.
        items.push(...results.items.map(item => _.omit(item, ['links'])))
        log.debug('SuiteQL query received %d/%d results', items.length, results.totalResults)
        hasMore = results.hasMore
      } catch (error) {
        log.error('SuiteQL query error - %s', query, { error })
        if (error instanceof InvalidSuiteAppCredentialsError) {
          throw error
        }
        return undefined
      }
    }
    log.debug('Finished running SuiteQL query with %d results: %s', items.length, query)
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

  private parseSystemInformation(results: unknown): SystemInformation | undefined {
    if (!this.ajv.validate<{ time: number; appVersion: number[] }>(
      SYSTEM_INFORMATION_SCHEME,
      results
    )) {
      log.error(`getSystemInformation failed. Got invalid results: ${this.ajv.errorsText()}`)
      return undefined
    }

    log.debug('SuiteApp system information', results)
    return { ...results, time: new Date(results.time) }
  }

  public async getSystemInformation(): Promise<SystemInformation | undefined> {
    try {
      const results = await this.sendRestletRequest('sysInfo')
      return this.parseSystemInformation(results)
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
          if (file.error.name === 'INSUFFICIENT_PERMISSION') {
            return new ReadFileInsufficientPermissionError(`No permission for reading file: ${JSON.stringify(file.error, undefined, 2)}`)
          }
          return new ReadFileError(`Received an error while tried to read file: ${JSON.stringify(file.error, undefined, 2)}`)
        }
        return NON_BINARY_FILETYPES.has(file.type) ? Buffer.from(file.content) : Buffer.from(file.content, 'base64')
      })
    } catch (error) {
      log.error('error was thrown in readFiles', { error })
      return undefined
    }
  }

  public async getConfigRecords(): Promise<ConfigRecord[]> {
    try {
      if (!(await this.isFeatureSupported('configTypes'))) {
        log.warn('SuiteApp version doesn\'t support configTypes')
        return []
      }
      const result = await this.sendRestletRequest('config', {
        action: 'get',
        types: CONFIG_RECORD_TYPES,
      })

      if (!this.ajv.validate<GetConfigResult>(GET_CONFIG_RESULT_SCHEMA, result)) {
        log.error('getConfigRecords failed. Got invalid results: %s', this.ajv.errorsText())
        return []
      }

      const { results, errors } = result
      if (results.length + errors.length !== CONFIG_RECORD_TYPES.length) {
        log.warn(
          'getConfigRecords received different amount of results than expected: %d istead of %d',
          results.length + errors.length,
          CONFIG_RECORD_TYPES.length
        )
      }
      log.debug('getConfigRecords received errors: %o', errors)

      return results.map(configRecord => {
        const { configType, fieldsDef, data } = configRecord
        if (!this.ajv.validate<ConfigRecordData>(CONFIG_RECORD_DATA_SCHEMA, data)) {
          log.error('failed parsing ConfigRecordData of type \'%s\': %s', configType, this.ajv.errorsText())
          return undefined
        }

        const validatedFields = fieldsDef.filter(fieldDef => {
          if (!this.ajv.validate<ConfigFieldDefinition>(CONFIG_FIELD_DEFINITION_SCHEMA, fieldDef)) {
            log.error('failed parsing ConfigFieldDefinition of type \'%s\': %s', configType, this.ajv.errorsText())
            return false
          }
          return true
        })

        return { configType, data, fieldsDef: validatedFields }
      }).filter(isDefined)
    } catch (e) {
      log.error('getConfigRecords failed. received error: %s', e.message)
      return []
    }
  }

  public async setConfigRecordsValues(
    types: SetConfigType[]
  ): Promise<SetConfigRecordsValuesResult> {
    try {
      if (!(await this.isFeatureSupported('configTypes'))) {
        log.warn('SuiteApp version doesn\'t support configTypes')
        return { errorMessage: 'SuiteApp version doesn\'t support configTypes' }
      }
      const result = await this.sendRestletRequest('config', { action: 'set', types })

      if (!this.ajv.validate<SetConfigResult>(SET_CONFIG_RESULT_SCHEMA, result)) {
        log.error('setConfigRecordsValues failed. Got invalid results: %s', this.ajv.errorsText())
        return { errorMessage: this.ajv.errorsText() }
      }
      return result
    } catch (e) {
      log.error('setConfigRecordsValues failed. received error: %s', e.message)
      return { errorMessage: e.message }
    }
  }

  public static async validateCredentials(credentials: SuiteAppCredentials): Promise<void> {
    const client = new SuiteAppClient({ credentials, globalLimiter: new Bottleneck() })
    await client.sendRestletRequest('sysInfo')
  }

  private async safeAxiosPost(
    href: string,
    data: unknown,
    headers: unknown
  ): Promise<AxiosResponse> {
    try {
      return await this.callsLimiter(() => this.axiosClient.post(
        href,
        data,
        { headers },
      ))
    } catch (e) {
      log.warn(
        'Received error from SuiteApp request to %s (postParams: %s) with status %s: %s',
        href,
        data,
        e.response.status,
        safeJsonStringify(e.response.data, undefined, 2)
      )
      if (UNAUTHORIZED_STATUSES.includes(e.response?.status)) {
        throw new InvalidSuiteAppCredentialsError()
      }
      throw e
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
    const response = await this.safeAxiosPost(url.href, { q: query }, headers)
    if (!this.ajv.validate<SuiteQLResults>(SUITE_QL_RESULTS_SCHEMA, response.data)) {
      throw new Error(`Got invalid results from the SuiteQL query: ${this.ajv.errorsText()}`)
    }

    return response.data
  }

  async isFeatureSupported(featureName: keyof VersionFeatures): Promise<boolean> {
    if (this.versionFeatures) {
      return this.versionFeatures[featureName]
    }
    await this.setVersionFeatures()
    return this.versionFeatures?.[featureName] === true
  }

  private async setVersionFeatures(): Promise<void> {
    if (this.versionFeatures) {
      return
    }

    await this.setVersionFeaturesLock.acquire('setVersionFeatures', async () => {
      if (this.versionFeatures) {
        return
      }
      log.debug('setting SuiteApp version features')
      const result = await this.innerSendRestletRequest('sysInfo')
      const sysInfo = this.parseSystemInformation(result)
      if (!sysInfo) {
        log.warn('could not detect SuiteApp version')
        return
      }
      const currentVersion = sysInfo.appVersion.join('.')
      this.versionFeatures = {
        activationKey: compareVersions(currentVersion, ACTIVATION_KEY_APP_VERSION) !== -1,
        configTypes: compareVersions(currentVersion, CONFIG_TYPES_APP_VERSION) !== -1,
      }
      log.debug('set SuiteApp version features successfully', { versionFeatures: this.versionFeatures })
    })
  }

  private async innerSendRestletRequest(
    operation: RestletOperation,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    const response = await this.safeAxiosPost(
      this.restletUrl.href,
      this.versionFeatures?.activationKey && this.credentials.suiteAppActivationKey
        ? { operation, args, activationKey: this.credentials.suiteAppActivationKey }
        : { operation, args },
      this.generateHeaders(this.restletUrl, 'POST')
    )
    log.debug(
      'Restlet call to operation %s (postParams: %s) responsed with status %s',
      operation,
      safeJsonStringify(args),
      response.status
    )

    if (!this.ajv.validate<RestletResults>(RESTLET_RESULTS_SCHEMA, response.data)) {
      throw new Error(`Got invalid results from a Restlet request: ${this.ajv.errorsText()}`)
    }

    if (isError(response.data)) {
      throw new Error(`Restlet request failed. Message: ${response.data.message}${response.data.error ? `, error: ${safeJsonStringify(response.data.error)}` : ''}`)
    }

    return response.data.results
  }

  private async sendRestletRequest(
    operation: RestletOperation,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    await this.setVersionFeatures()
    return this.innerSendRestletRequest(operation, args)
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

  public async getAllRecords(types: string[]): Promise<Record<string, unknown>[]> {
    return this.soapClient.getAllRecords(types)
  }

  public async updateInstances(instances: InstanceElement[]): Promise<(number | Error)[]> {
    return this.soapClient.updateInstances(instances)
  }

  public async addInstances(instances: InstanceElement[]): Promise<(number | Error)[]> {
    return this.soapClient.addInstances(instances)
  }

  public async deleteInstances(instances: InstanceElement[]): Promise<(number | Error)[]> {
    return this.soapClient.deleteInstances(instances)
  }
}
