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
import Bottleneck from 'bottleneck'
import OAuth from 'oauth-1.0a'
import crypto from 'crypto'
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import axiosRetry from 'axios-retry'
import Ajv, { Schema } from 'ajv'
import AsyncLock from 'async-lock'
import compareVersions from 'compare-versions'
import os from 'os'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { values, decorators } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils, soap } from '@salto-io/adapter-components'
import { InstanceElement } from '@salto-io/adapter-api'
import {
  CallsLimiter,
  ConfigRecord,
  ConfigRecordData,
  GetConfigResult,
  CONFIG_RECORD_DATA_SCHEMA,
  GET_CONFIG_RESULT_SCHEMA,
  ExistingFileCabinetInstanceDetails,
  FILES_READ_SCHEMA,
  HttpMethod,
  isError,
  ReadResults,
  RestletOperation,
  RestletResults,
  RESTLET_RESULTS_SCHEMA,
  SavedSearchQuery,
  SavedSearchResults,
  SAVED_SEARCH_RESULTS_SCHEMA,
  SuiteAppClientParameters,
  SuiteQLResults,
  SUITE_QL_RESULTS_SCHEMA,
  SystemInformation,
  SYSTEM_INFORMATION_SCHEME,
  FileCabinetInstanceDetails,
  ConfigFieldDefinition,
  CONFIG_FIELD_DEFINITION_SCHEMA,
  SetConfigType,
  SET_CONFIG_RESULT_SCHEMA,
  SetConfigRecordsValuesResult,
  SetConfigResult,
  HasElemIDFunc,
  GET_BUNDLES_RESULT_SCHEMA,
  GET_SUITEAPPS_RESULT_SCHEMA,
  QueryRecordSchema,
  QueryRecordResponse,
  SuiteAppType,
  QUERY_RECORDS_RESPONSE_SCHEMA,
} from './types'
import { SuiteAppCredentials, toUrlAccountId } from '../credentials'
import { SUITEAPP_CONFIG_RECORD_TYPES } from '../../types'
import { DEFAULT_AXIOS_TIMEOUT_IN_MINUTES, DEFAULT_CONCURRENCY } from '../../config/constants'
import { CONSUMER_KEY, CONSUMER_SECRET, INSUFFICIENT_PERMISSION_ERROR } from './constants'
import SoapClient from './soap_client/soap_client'
import { CustomRecordResponse, RecordResponse } from './soap_client/types'
import {
  ReadFileEncodingError,
  ReadFileError,
  ReadFileInsufficientPermissionError,
  RetryableError,
  retryOnRetryableError,
} from './errors'
import { InvalidSuiteAppCredentialsError } from '../types'
import { SuiteAppBundleType } from '../../types/bundle_type'

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
  'JSON',
  'FREEMARKER',
])

const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
}

const UNAUTHORIZED_STATUSES = [401, 403]
const HTTP_SERVER_ERROR_INITIAL = '5'
const RETRYABLE_ERROR_CODES = ['SSS_REQUEST_LIMIT_EXCEEDED']

const ACTIVATION_KEY_APP_VERSION = '0.1.3'
const CONFIG_TYPES_APP_VERSION = '0.1.4'
const LIST_BUNDLES_APP_VERSION = '0.1.7'
const RECORD_OPERATION_APP_VERSION = '0.2.0'

type VersionFeatures = {
  activationKey: boolean
  configTypes: boolean
  listBundles: boolean
  recordOperation: boolean
}

const getAxiosErrorDetailedMessage = (error: AxiosError): string | undefined => {
  const errorDetails = error.response?.data?.['o:errorDetails']
  if (!_.isArray(errorDetails)) {
    return undefined
  }
  const detailedMessages = errorDetails.map(errorItem => errorItem?.detail).filter(_.isString)
  return detailedMessages.length > 0 ? detailedMessages.join(os.EOL) : undefined
}

export const retryable = decorators.wrapMethodWith(
  async (call: decorators.OriginalCall): Promise<unknown> => retryOnRetryableError(async () => call.call()),
)

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
    this.callsLimiter = fn => limiter.schedule(() => params.globalLimiter.schedule(fn))

    const accountIdUrl = toUrlAccountId(params.credentials.accountId)
    this.suiteQLUrl = new URL(`https://${accountIdUrl}.suitetalk.api.netsuite.com/services/rest/query/v1/suiteql`)
    this.restletUrl = new URL(
      `https://${accountIdUrl}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_salto_restlet&deploy=customdeploy_salto_restlet`,
    )

    this.ajv = new Ajv({ allErrors: true, strict: false })
    const timeout = (params.config?.httpTimeoutLimitInMinutes ?? DEFAULT_AXIOS_TIMEOUT_IN_MINUTES) * 60 * 1000
    this.soapClient = new SoapClient(this.credentials, this.callsLimiter, params.instanceLimiter, timeout)

    this.axiosClient = axios.create({ timeout })
    const retryOptions = createRetryOptions(DEFAULT_RETRY_OPTS)
    axiosRetry(this.axiosClient, {
      ...retryOptions,
      retryCondition: err =>
        retryOptions.retryCondition?.(err) ||
        String(err.response?.status).startsWith(HTTP_SERVER_ERROR_INITIAL) ||
        RETRYABLE_ERROR_CODES.some(code => code === err.response?.data?.error?.code?.toUpperCase()),
    })

    this.versionFeatures = undefined
    this.setVersionFeaturesLock = new AsyncLock()
  }

  private async runSuiteQLWithForLoop(query: string, initialOffset: number): Promise<Record<string, unknown>[]> {
    log.debug('Running SuiteQL query using for loop: %s', query)
    let hasMore = true
    let items: Record<string, unknown>[] = []
    for (let offset = initialOffset; hasMore; offset += PAGE_SIZE) {
      // eslint-disable-next-line no-await-in-loop
      const results = await this.sendSuiteQLRequest(query, offset, PAGE_SIZE)
      items = items.concat(results.items)
      log.debug('SuiteQL query received %d/%d results: %s', offset + results.items.length, results.totalResults, query)
      hasMore = results.hasMore
    }
    return items
  }

  private async runSuiteQLWithPromiseAll(
    query: string,
    initialOffset: number,
    lastOffset: number,
  ): Promise<Record<string, unknown>[]> {
    log.debug('Running SuiteQL query using promise all: %s', query)
    return Promise.all(
      _.range(initialOffset, lastOffset + 1, PAGE_SIZE).map(async offset => {
        const results = await this.sendSuiteQLRequest(query, offset, PAGE_SIZE)
        log.debug(
          'SuiteQL query received %d/%d results: %s',
          offset + results.items.length,
          results.totalResults,
          query,
        )
        if (offset === lastOffset && results.hasMore) {
          log.warn('SuiteQL query reached the last page (offset: %d), but hasMore is true: %s', offset, query)
        }
        return results.items
      }),
    ).then(res => res.flat())
  }

  private async runFirstSuiteQLQuery(query: string): Promise<{
    items: Record<string, unknown>[]
    nextOffset?: number
    lastOffset?: number
  }> {
    const results = await this.sendSuiteQLRequest(query, 0, PAGE_SIZE)
    const nextOffset = results.hasMore ? PAGE_SIZE : undefined
    const lastPageHref = results.links?.find(link => link.rel === 'last')?.href
    const lastOffsetStr = lastPageHref !== undefined ? new URL(lastPageHref).searchParams.get('offset') : null
    const lastOffset = lastOffsetStr !== null ? Number(lastOffsetStr) : undefined
    log.debug('First SuiteQL query result: %o', {
      query,
      numOfItems: results.items.length,
      totalResults: results.totalResults,
      nextOffset,
      lastOffset,
    })
    return {
      items: results.items,
      nextOffset,
      lastOffset,
    }
  }

  /**
   * WARNING:
   * Due to a bug in NetSuite SuiteQL, make sure to use
   * ORDER BY <some unique identifier> ASC/DESC in your queries.
   * Otherwise, you might not get all the results.
   */
  public async runSuiteQL(
    query: string,
    throwOnErrors: Record<string, string> = {},
  ): Promise<Record<string, unknown>[] | undefined> {
    log.debug('Running SuiteQL query: %s', query)
    if (!/ORDER BY .* (ASC|DESC)/.test(query) && !/count\(\*\)/i.test(query)) {
      log.warn(
        `SuiteQL ${query} does not contain ORDER BY <unique identifier> ASC/DESC, which can cause the response to not contain all the results`,
      )
    }
    try {
      const { items: firstPageItems, nextOffset, lastOffset } = await this.runFirstSuiteQLQuery(query)

      if (nextOffset === undefined) {
        log.debug('Finished running SuiteQL query with %d results: %s', firstPageItems.length, query)
        return firstPageItems
      }

      const restOfItems =
        lastOffset !== undefined
          ? await this.runSuiteQLWithPromiseAll(query, nextOffset, lastOffset)
          : await this.runSuiteQLWithForLoop(query, nextOffset)

      const items = firstPageItems.concat(restOfItems)
      log.debug('Finished running SuiteQL query with %d results: %s', items.length, query)

      return items
    } catch (error) {
      log.warn('SuiteQL query error - %s', query, { error })
      if (error instanceof InvalidSuiteAppCredentialsError) {
        throw error
      }
      if (axios.isAxiosError(error)) {
        const errorDetailedMessage = getAxiosErrorDetailedMessage(error)
        const matchingErrorKey = Object.keys(throwOnErrors).find(e => errorDetailedMessage?.includes(e))
        if (matchingErrorKey !== undefined) {
          throw new Error(throwOnErrors[matchingErrorKey])
        }
      }
      return undefined
    }
  }

  public async runSavedSearchQuery(
    query: SavedSearchQuery,
    limit = Infinity,
  ): Promise<Record<string, unknown>[] | undefined> {
    let hasMore = true
    const items: Record<string, unknown>[] = []
    const pageSize = Math.min(limit, PAGE_SIZE)
    for (let offset = 0; hasMore; offset += pageSize) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const results = await this.sendSavedSearchRequest(query, offset, pageSize)
        items.push(...results)
        hasMore = results.length === pageSize && items.length < limit
      } catch (error) {
        log.error('Saved search query error', { error })
        return undefined
      }
    }
    return items
  }

  private isValidRecordsQueryResponse(results: unknown): results is QueryRecordResponse[] {
    if (!this.ajv.validate<QueryRecordResponse[]>(QUERY_RECORDS_RESPONSE_SCHEMA, results)) {
      log.error('Got invalid results from records query - %s: %o', this.ajv.errorsText(), results)
      return false
    }
    const errors = results.flatMap(res => res.errors ?? [])
    if (errors.length > 0) {
      log.warn('runRecordsQuery had errors: %s', errors.join(', '))
    }
    return results.every(res => this.isValidRecordsQueryResponse(res.sublists))
  }

  public async runRecordsQuery(ids: string[], schema: QueryRecordSchema): Promise<QueryRecordResponse[] | undefined> {
    if (!(await this.isFeatureSupported('recordOperation'))) {
      log.warn("SuiteApp version doesn't support recordOperation")
      return undefined
    }
    try {
      const results = await this.sendRestletRequest('record', { ids, schema })
      return this.isValidRecordsQueryResponse(results) ? results : undefined
    } catch (error) {
      log.error('runRecordsQuery failed with error: %o', error)
      return undefined
    }
  }

  private parseSystemInformation(results: unknown): SystemInformation | undefined {
    if (!this.ajv.validate<SystemInformation>(SYSTEM_INFORMATION_SCHEME, results)) {
      log.error('getSystemInformation failed. Got invalid results - %s: %o', this.ajv.errorsText(), results)
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
      if (error instanceof InvalidSuiteAppCredentialsError) {
        throw error
      }
      log.error('error was thrown in getSystemInformation', { error })
      return undefined
    }
  }

  public async readFiles(ids: number[]): Promise<(Buffer | Error)[] | undefined> {
    try {
      const results = await this.sendRestletRequest('readFile', { ids })

      if (!this.ajv.validate<ReadResults>(FILES_READ_SCHEMA, results)) {
        log.error('readFiles failed. Got invalid results - %s: %o', this.ajv.errorsText(), results)
        return undefined
      }

      return results.map(file => {
        if (file.status === 'error') {
          if (file.error.name === 'INVALID_FILE_ENCODING') {
            return new ReadFileEncodingError(
              `Received file encoding error: ${JSON.stringify(file.error, undefined, 2)}`,
            )
          }
          log.warn(`Received file read error: ${JSON.stringify(file.error, undefined, 2)}`)
          if (file.error.name === INSUFFICIENT_PERMISSION_ERROR) {
            return new ReadFileInsufficientPermissionError(
              `No permission for reading file: ${JSON.stringify(file.error, undefined, 2)}`,
            )
          }
          return new ReadFileError(
            `Received an error while tried to read file: ${JSON.stringify(file.error, undefined, 2)}`,
          )
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
        log.warn("SuiteApp version doesn't support configTypes")
        return []
      }
      const result = await this.sendRestletRequest('config', {
        action: 'get',
        types: SUITEAPP_CONFIG_RECORD_TYPES,
      })
      if (!this.ajv.validate<GetConfigResult>(GET_CONFIG_RESULT_SCHEMA, result)) {
        log.error('getConfigRecords failed. Got invalid results - %s: %o', this.ajv.errorsText(), result)
        return []
      }

      const { results, errors } = result
      if (results.length + errors.length !== SUITEAPP_CONFIG_RECORD_TYPES.length) {
        log.warn(
          'getConfigRecords received different amount of results than expected: %d instead of %d',
          results.length + errors.length,
          SUITEAPP_CONFIG_RECORD_TYPES.length,
        )
      }
      if (errors.length > 0) {
        log.debug('getConfigRecords received errors: %o', errors)
      }

      return results
        .map(configRecord => {
          const { configType, fieldsDef, data } = configRecord
          if (!this.ajv.validate<ConfigRecordData>(CONFIG_RECORD_DATA_SCHEMA, data)) {
            log.error("failed parsing ConfigRecordData of type '%s' - %s: %o", configType, this.ajv.errorsText(), data)
            return undefined
          }

          const validatedFields = fieldsDef.filter(fieldDef => {
            if (!this.ajv.validate<ConfigFieldDefinition>(CONFIG_FIELD_DEFINITION_SCHEMA, fieldDef)) {
              log.error(
                "failed parsing ConfigFieldDefinition of type '%s' - %s: %o",
                configType,
                this.ajv.errorsText(),
                fieldDef,
              )
              return false
            }
            return true
          })

          return { configType, data, fieldsDef: validatedFields }
        })
        .filter(isDefined)
    } catch (e) {
      if (e instanceof InvalidSuiteAppCredentialsError) {
        throw e
      }
      log.error('getConfigRecords failed. received error: %s', e.message)
      return []
    }
  }

  public async setConfigRecordsValues(types: SetConfigType[]): Promise<SetConfigRecordsValuesResult> {
    try {
      if (!(await this.isFeatureSupported('configTypes'))) {
        log.warn("SuiteApp version doesn't support configTypes")
        return { errorMessage: "SuiteApp version doesn't support configTypes" }
      }
      const result = await this.sendRestletRequest('config', { action: 'set', types })

      if (!this.ajv.validate<SetConfigResult>(SET_CONFIG_RESULT_SCHEMA, result)) {
        log.error('setConfigRecordsValues failed. Got invalid results - %s: %o', this.ajv.errorsText(), result)
        return { errorMessage: this.ajv.errorsText() }
      }
      return result
    } catch (e) {
      log.error('setConfigRecordsValues failed. received error: %s', e.message)
      return { errorMessage: e.message }
    }
  }

  public async getInstalledBundles(): Promise<SuiteAppBundleType[]> {
    return this.getInstalledBundlesOrSuiteApps<SuiteAppBundleType>('listBundles', GET_BUNDLES_RESULT_SCHEMA)
  }

  public async getInstalledSuiteApps(): Promise<SuiteAppType[]> {
    return this.getInstalledBundlesOrSuiteApps<SuiteAppType>('listSuiteApps', GET_SUITEAPPS_RESULT_SCHEMA)
  }

  public async getInstalledBundlesOrSuiteApps<T>(
    operation: Extract<RestletOperation, 'listBundles' | 'listSuiteApps'>,
    schema: Schema,
  ): Promise<T[]> {
    try {
      if (!(await this.isFeatureSupported('listBundles'))) {
        log.warn(`SuiteApp version doesn't support ${operation}`)
        return []
      }
      const result = await this.sendRestletRequest(operation)
      if (!this.ajv.validate<T[]>(schema, result)) {
        log.error(`${operation} failed. Got invalid results - %s: %o`, this.ajv.errorsText(), result)
        throw Error(this.ajv.errorsText())
      }
      return result
    } catch (e) {
      const errorMessage = `${operation} operation failed. Received the following error: ${e.message}`
      log.error(errorMessage)
      throw Error(errorMessage)
    }
  }

  public static async validateCredentials(credentials: SuiteAppCredentials): Promise<SystemInformation> {
    const client = new SuiteAppClient({
      credentials,
      globalLimiter: new Bottleneck(),
      instanceLimiter: () => false,
    })
    const sysInfo = await client.getSystemInformation()

    if (sysInfo === undefined) {
      throw new Error('Failed getting SuiteApp system information')
    }
    return sysInfo
  }

  private async safeAxiosPost(href: string, data: unknown, headers: Record<string, unknown>): Promise<AxiosResponse> {
    try {
      return await this.callsLimiter(() =>
        this.axiosClient.post(href, data, {
          headers: {
            ...headers,
            ...this.generateAuthHeader(href, 'POST'),
          },
        }),
      )
    } catch (e) {
      log.warn(
        'Received error from SuiteApp request to %s (postParams: %s) with status %s: %s',
        href,
        data,
        e.response?.status ?? e.code,
        safeJsonStringify(e.response?.data ?? e.message, undefined, 2),
      )
      if (UNAUTHORIZED_STATUSES.includes(e.response?.status)) {
        throw new InvalidSuiteAppCredentialsError(getAxiosErrorDetailedMessage(e))
      }
      throw e
    }
  }

  @retryable
  private async sendSuiteQLRequest(query: string, offset: number, limit: number): Promise<SuiteQLResults> {
    const url = new URL(this.suiteQLUrl.href)
    url.searchParams.append('limit', limit.toString())
    url.searchParams.append('offset', offset.toString())

    const headers = {
      ...REQUEST_HEADERS,
      prefer: 'transient',
    }
    const response = await this.safeAxiosPost(url.href, { q: query }, headers)
    if (!this.ajv.validate<SuiteQLResults>(SUITE_QL_RESULTS_SCHEMA, response.data)) {
      log.error('Got invalid results from the SuiteQL query - %s: %o', this.ajv.errorsText(), response.data)
      throw new RetryableError(new Error('Invalid SuiteQL query result'))
    }

    return {
      ...response.data,
      // For some reason, a "links" field with empty array is returned regardless to the SELECT values in the query.
      items: response.data.items.map(item => _.omit(item, ['links'])),
    }
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
        listBundles: compareVersions(currentVersion, LIST_BUNDLES_APP_VERSION) !== -1,
        recordOperation: compareVersions(currentVersion, RECORD_OPERATION_APP_VERSION) !== -1,
      }
      log.debug('set SuiteApp version features successfully', { versionFeatures: this.versionFeatures })
    })
  }

  @retryable
  private async innerSendRestletRequest(
    operation: RestletOperation,
    args: Record<string, unknown> = {},
  ): Promise<unknown> {
    const response = await this.safeAxiosPost(
      this.restletUrl.href,
      this.versionFeatures?.activationKey && this.credentials.suiteAppActivationKey
        ? { operation, args, activationKey: this.credentials.suiteAppActivationKey }
        : { operation, args },
      REQUEST_HEADERS,
    )
    log.debug(
      'Restlet call to operation %s (postParams: %s) responsed with status %s',
      operation,
      safeJsonStringify(args),
      response.status,
    )

    if (!this.ajv.validate<RestletResults>(RESTLET_RESULTS_SCHEMA, response.data)) {
      log.error('Got invalid results from a Restlet request - %s: %o', this.ajv.errorsText(), response.data)
      throw new RetryableError(new Error('Invalid Restlet query result'))
    }

    if (isError(response.data)) {
      throw new Error(
        `Restlet request failed. Message: ${response.data.message}${response.data.error ? `, error: ${safeJsonStringify(response.data.error)}` : ''}`,
      )
    }

    return response.data.results
  }

  private async sendRestletRequest(operation: RestletOperation, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.setVersionFeatures()
    return this.innerSendRestletRequest(operation, args)
  }

  @retryable
  private async sendSavedSearchRequest(
    query: SavedSearchQuery,
    offset: number,
    limit: number,
  ): Promise<SavedSearchResults> {
    const results = await this.sendRestletRequest('search', {
      ...query,
      offset,
      limit,
    })

    if (!this.ajv.validate<SavedSearchResults>(SAVED_SEARCH_RESULTS_SCHEMA, results)) {
      log.error('Got invalid results from the saved search query - %s: %o', this.ajv.errorsText(), results)
      throw new RetryableError(new Error('Invalid Saved Search query error'))
    }

    return results
  }

  private generateAuthHeader(url: string, method: HttpMethod): OAuth.Header {
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

    const token = {
      key: this.credentials.suiteAppTokenId,
      secret: this.credentials.suiteAppTokenSecret,
    }

    return oauth.toHeader(oauth.authorize({ url, method }, token))
  }

  // This function should be used for files which are bigger than 10 mb,
  // otherwise readFiles should be used
  public async readLargeFile(id: number): Promise<Buffer | Error> {
    try {
      return await this.soapClient.readFile(id)
    } catch (e) {
      return e as Error
    }
  }

  public async updateFileCabinetInstances(
    fileCabinetInstances: ExistingFileCabinetInstanceDetails[],
  ): Promise<(number | Error)[]> {
    return this.soapClient.updateFileCabinetInstances(fileCabinetInstances)
  }

  public async addFileCabinetInstances(
    fileCabinetInstances: FileCabinetInstanceDetails[],
  ): Promise<(number | Error)[]> {
    return this.soapClient.addFileCabinetInstances(fileCabinetInstances)
  }

  public async deleteFileCabinetInstances(
    fileCabinetInstances: ExistingFileCabinetInstanceDetails[],
  ): Promise<(number | Error)[]> {
    return this.soapClient.deleteFileCabinetInstances(fileCabinetInstances)
  }

  public async getNetsuiteWsdl(): Promise<soap.WSDL> {
    return this.soapClient.getNetsuiteWsdl()
  }

  public async getAllRecords(types: string[]): Promise<RecordResponse> {
    return this.soapClient.getAllRecords(types)
  }

  public async getCustomRecords(customRecordTypes: string[]): Promise<CustomRecordResponse> {
    return this.soapClient.getCustomRecords(customRecordTypes)
  }

  public async updateInstances(instances: InstanceElement[], hasElemID: HasElemIDFunc): Promise<(number | Error)[]> {
    return this.soapClient.updateInstances(instances, hasElemID)
  }

  public async addInstances(instances: InstanceElement[], hasElemID: HasElemIDFunc): Promise<(number | Error)[]> {
    return this.soapClient.addInstances(instances, hasElemID)
  }

  public async deleteInstances(instances: InstanceElement[]): Promise<(number | Error)[]> {
    return this.soapClient.deleteInstances(instances)
  }

  public async deleteSdfInstances(instances: InstanceElement[]): Promise<(number | Error)[]> {
    return this.soapClient.deleteSdfInstances(instances)
  }

  public async getSelectValue(
    type: string,
    field: string,
    filterBy: { field: string; internalId: string }[],
  ): Promise<Record<string, string[]>> {
    return this.soapClient.getSelectValue(type, field, filterBy)
  }
}
