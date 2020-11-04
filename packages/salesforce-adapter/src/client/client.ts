/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { EOL } from 'os'
import requestretry, { RequestRetryOptions, RetryStrategies } from 'requestretry'
import { collections, decorators } from '@salto-io/lowerdash'
import {
  Connection as RealConnection, MetadataObject, DescribeGlobalSObjectResult, FileProperties,
  MetadataInfo, SaveResult, DescribeSObjectResult, DeployResult, RetrieveRequest, RetrieveResult,
  ListMetadataQuery, UpsertResult, QueryResult, DescribeValueTypeResult,
  BatchResultInfo, BulkLoadOperation,
} from 'jsforce'
import { flatValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Options, RequestCallback } from 'request'
import { AccountId, Value } from '@salto-io/adapter-api'
import { CUSTOM_OBJECT_ID_FIELD } from '../constants'
import { CompleteSaveResult, SfError, SalesforceRecord } from './types'
import { UsernamePasswordCredentials, OauthAccessTokenCredentials, Credentials, SalesforceClientConfig } from '../types'
import Connection from './jsforce'

const { makeArray } = collections.array

const log = logger(module)

export const API_VERSION = '47.0'
export const METADATA_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

// Salesforce limitation of maximum number of items per create/update/delete call
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_createMetadata.htm
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_updateMetadata.htm
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deleteMetadata.htm
const MAX_ITEMS_IN_WRITE_REQUEST = 10

// Salesforce limitation of maximum number of items per describeSObjects call
//  https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_calls_describesobjects.htm?search_text=describeSObjects
const MAX_ITEMS_IN_DESCRIBE_REQUEST = 100

// Salesforce limitation of maximum number of items per readMetadata call
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_readMetadata.htm
const MAX_ITEMS_IN_READ_METADATA_REQUEST = 10

// Salesforce limitation of maximum number of ListMetadataQuery per listMetadata call
//  https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_listmetadata.htm?search_text=listmetadata
const MAX_ITEMS_IN_LIST_METADATA_REQUEST = 3

const RETRY_DELAY = 5000

export const DEFAULT_RETRY_OPTS: RequestRetryOptions = {
  maxAttempts: 5, // try 5 times
  retryStrategy: RetryStrategies.NetworkError, // retry on network errors
  delayStrategy: (err, _response, _body) => {
    log.error('failed to run SFDC call for reason: %s. Retrying in %ss.', err.message, (RETRY_DELAY / 1000))
    return RETRY_DELAY
  },
}

const isAlreadyDeletedError = (error: SfError): boolean => (
  error.statusCode === 'INVALID_CROSS_REFERENCE_KEY'
  && error.message.match(/no.*named.*found/) !== null
)

export type ErrorFilter = (error: Error) => boolean

const isSFDCUnhandledException = (error: Error): boolean => error.name !== 'sf:UNKNOWN_EXCEPTION'

const validateCRUDResult = (isDelete: boolean): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(
    async (original: decorators.OriginalCall): Promise<unknown> => {
      const result = await original.call()

      const errors = _(makeArray(result))
        .filter(r => r)
        .map(r => r as CompleteSaveResult)
        .map(r => makeArray(r.errors))
        .flatten()
        .value()

      const [silencedErrors, realErrors] = _.partition(
        errors,
        err => isDelete && isAlreadyDeletedError(err),
      )
      if (silencedErrors.length > 0) {
        log.debug('ignoring errors:%s%s', EOL, silencedErrors.map(e => e.message).join(EOL))
      }
      if (realErrors.length > 0) {
        throw new Error(realErrors.map(e => e.message).join(EOL))
      }

      return result
    }
  )

const validateDeleteResult = validateCRUDResult(true)
const validateSaveResult = validateCRUDResult(false)

export type SalesforceClientOpts = {
  credentials: Credentials
  connection?: Connection
  retryOptions?: RequestRetryOptions
  config?: SalesforceClientConfig
}

const DEFAULT_POLLING_CONFIG = {
  interval: 3000,
  timeout: 5400000,
}

export const setPollIntervalForConnection = (
  connection: Connection,
  pollingConfig: SalesforceClientConfig['polling'],
): void => {
  const interval = pollingConfig?.interval ?? DEFAULT_POLLING_CONFIG.interval
  const timeout = pollingConfig?.timeout ?? DEFAULT_POLLING_CONFIG.timeout
  // Set poll interval and timeout for deploy
  connection.metadata.pollInterval = interval
  connection.metadata.pollTimeout = timeout

  // Set poll interval and timeout for bulk ops, (e.g, CSV deletes)
  connection.bulk.pollInterval = interval
  connection.bulk.pollTimeout = timeout
}

export const createRequestModuleFunction = (retryOptions: RequestRetryOptions) =>
  (opts: Options, callback: RequestCallback) =>
    requestretry({ ...retryOptions, ...opts }, (err, response, body) => {
      const attempts = _.get(response, 'attempts') || _.get(err, 'attempts')
      if (attempts && attempts > 1) {
        log.warn('sfdc client retry attempts: %o', attempts)
      }
      return callback(err, response, body)
    })

const oauthConnection = (
  instanceUrl: string,
  accessToken: string,
  retryOptions: RequestRetryOptions,
): Connection => {
  const connection = new RealConnection({
    version: API_VERSION,
    instanceUrl,
    accessToken,
    requestModule: createRequestModuleFunction(retryOptions),
  })
  return connection
}

const realConnection = (
  isSandbox: boolean,
  retryOptions: RequestRetryOptions,
): Connection => {
  const connection = new RealConnection({
    version: API_VERSION,
    loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`,
    requestModule: createRequestModuleFunction(retryOptions),
  })
  return connection
}

type SendChunkedArgs<TIn, TOut> = {
  input: TIn | TIn[]
  sendChunk: (chunk: TIn[]) => Promise<TOut | TOut[]>
  operationInfo: string
  chunkSize?: number
  isSuppressedError?: ErrorFilter
  isUnhandledError?: ErrorFilter
}
export type SendChunkedResult<TIn, TOut> = {
  result: TOut[]
  errors: TIn[]
}
const sendChunked = async <TIn, TOut>({
  input,
  sendChunk,
  operationInfo,
  chunkSize = MAX_ITEMS_IN_WRITE_REQUEST,
  isSuppressedError = () => false,
  isUnhandledError = () => true,
}: SendChunkedArgs<TIn, TOut>): Promise<SendChunkedResult<TIn, TOut>> => {
  const sendSingleChunk = async (chunkInput: TIn[]):
  Promise<SendChunkedResult<TIn, TOut>> => {
    try {
      return { result: makeArray(await sendChunk(chunkInput)).map(flatValues), errors: [] }
    } catch (error) {
      if (chunkInput.length > 1) {
        // Try each input individually to single out the one that caused the error
        log.error('chunked %s failed on chunk with error: %s. Message: %s. Trying each element separately.',
          operationInfo, error.name, error.message)
        const sendChunkResult = await Promise.all(chunkInput.map(item => sendSingleChunk([item])))
        return {
          result: _.flatten(sendChunkResult.map(e => e.result).map(flatValues)),
          errors: _.flatten(sendChunkResult.map(e => e.errors)),
        }
      }
      if (isSuppressedError(error)) {
        log.warn('chunked %s ignoring recoverable error on %o: %s',
          operationInfo, chunkInput[0], error.message)
        return { result: [], errors: [] }
      }
      if (isUnhandledError(error)) {
        log.error('chunked %s unrecoverable error on %o: %o',
          operationInfo, chunkInput[0], error)
        throw error
      }
      log.warn('chunked %s unknown error on %o: %o',
        operationInfo, chunkInput[0], error)
      return { result: [], errors: chunkInput }
    }
  }
  const result = await Promise.all(_.chunk(makeArray(input), chunkSize)
    .filter(chunk => !_.isEmpty(chunk))
    .map(sendSingleChunk))
  return {
    result: _.flatten(result.map(e => e.result)),
    errors: _.flatten(result.map(e => e.errors)),
  }
}

export class ApiLimitsTooLowError extends Error {}

const createConnectionFromCredentials = (
  creds: Credentials,
  options: RequestRetryOptions,
): Connection => {
  if (creds instanceof OauthAccessTokenCredentials) {
    return oauthConnection(creds.instanceUrl, creds.accessToken, options)
  }
  return realConnection(creds.isSandbox, options)
}

export const loginFromCredentialsAndReturnOrgId = async (
  connection: Connection, creds: Credentials): Promise<string> => {
  if (creds instanceof UsernamePasswordCredentials) {
    return (await connection.login(creds.username, creds.password + (creds.apiToken ?? ''))).organizationId
  }
  // Oauth connection doesn't require further login
  return (await connection.identity()).organization_id
}

export const getConnectionDetails = async (
  creds: Credentials, connection? : Connection): Promise<{
  remainingDailyRequests: number
  orgId: string
}> => {
  const options = {
    maxAttempts: 2,
    retryStrategy: RetryStrategies.HTTPOrNetworkError,
  }
  const conn = connection || (await createConnectionFromCredentials(creds, options))
  const orgId = (await loginFromCredentialsAndReturnOrgId(conn, creds))
  const limits = await conn.limits()
  return {
    remainingDailyRequests: limits.DailyApiRequests.Remaining,
    orgId,
  }
}

export const validateCredentials = async (
  creds: Credentials, minApiRequestsRemaining = 0, connection?: Connection,
): Promise<AccountId> => {
  const { remainingDailyRequests, orgId } = await getConnectionDetails(
    creds, connection
  )
  if (remainingDailyRequests < minApiRequestsRemaining) {
    throw new ApiLimitsTooLowError(
      `Remaining limits: ${remainingDailyRequests}, needed: ${minApiRequestsRemaining}`
    )
  }
  return orgId
}

export default class SalesforceClient {
  private readonly conn: Connection
  private isLoggedIn = false
  private readonly credentials: Credentials
  private readonly config?: SalesforceClientConfig

  constructor(
    { credentials, connection, retryOptions, config }: SalesforceClientOpts
  ) {
    this.credentials = credentials
    this.config = config
    this.conn = connection
      || createConnectionFromCredentials(credentials, retryOptions || DEFAULT_RETRY_OPTS)
    setPollIntervalForConnection(this.conn, config?.polling)
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      await loginFromCredentialsAndReturnOrgId(this.conn, this.credentials)
      this.isLoggedIn = true
    }
  }

  protected static requiresLogin = decorators.wrapMethodWith(
    async function withLogin(
      this: SalesforceClient,
      originalMethod: decorators.OriginalCall
    ): Promise<unknown> {
      await this.ensureLoggedIn()
      return originalMethod.call()
    }
  )

  private static logDecorator = (keys?: string[]): decorators.InstanceMethodDecorator =>
    decorators.wrapMethodWith(
      // eslint-disable-next-line prefer-arrow-callback
      async function logFailure(
        this: SalesforceClient,
        { call, name, args }: decorators.OriginalCall,
      ): Promise<unknown> {
        const printableArgs = args
          .map(arg => {
            const keysValues = (keys ?? [])
              .map(key => _.get(arg, key))
              .filter(_.isString)
            return _.isEmpty(keysValues) ? arg : keysValues.join(', ')
          })
          .filter(_.isString)
          .join(', ')
        const desc = `client.${name}(${printableArgs})`
        try {
          return await log.time(call, desc)
        } catch (e) {
          log.error('failed to run SFDC client call %s: %s', desc, e.message)
          throw e
        }
      }
    )

  /**
   * Extract metadata object names
   */
  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async listMetadataTypes(): Promise<MetadataObject[]> {
    const describeResult = this.conn.metadata.describe()
    return flatValues((await describeResult).metadataObjects)
  }

  /**
   * Read information about a value type
   * @param type The name of the metadata type for which you want metadata
   */
  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async describeMetadataType(type: string): Promise<DescribeValueTypeResult> {
    const fullName = `{${METADATA_NAMESPACE}}${type}`
    const describeResult = await this.conn.metadata.describeValueType(fullName)
    return flatValues(describeResult)
  }

  @SalesforceClient.logDecorator(['type', '0.type'])
  @SalesforceClient.requiresLogin
  public async listMetadataObjects(
    listMetadataQuery: ListMetadataQuery | ListMetadataQuery[],
    isUnhandledError: ErrorFilter = isSFDCUnhandledException,
  ): Promise<SendChunkedResult<ListMetadataQuery, FileProperties>> {
    return sendChunked({
      operationInfo: 'listMetadataObjects',
      input: listMetadataQuery,
      sendChunk: chunk => this.conn.metadata.list(chunk),
      chunkSize: MAX_ITEMS_IN_LIST_METADATA_REQUEST,
      isUnhandledError,
    })
  }

  /**
   * Read metadata for salesforce object of specific type and name
   */
  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async readMetadata(
    type: string,
    name: string | string[],
    isUnhandledError: ErrorFilter = isSFDCUnhandledException,
  ): Promise<SendChunkedResult<string, MetadataInfo>> {
    return sendChunked({
      operationInfo: `readMetadata (${type})`,
      input: name,
      sendChunk: chunk => this.conn.metadata.read(type, chunk),
      chunkSize: MAX_ITEMS_IN_READ_METADATA_REQUEST,
      isSuppressedError: error => (
        (this.credentials.isSandbox && type === 'QuickAction' && error.message === 'targetObject is invalid')
        || (error.name === 'sf:INSUFFICIENT_ACCESS')
      ),
      isUnhandledError,
    })
  }

  /**
   * Extract sobject names
   */
  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    return flatValues((await this.conn.describeGlobal()).sobjects)
  }

  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async describeSObjects(objectNames: string[]):
  Promise<DescribeSObjectResult[]> {
    return (await sendChunked({
      operationInfo: 'describeSObjects',
      input: objectNames,
      sendChunk: chunk => this.conn.soap.describeSObjects(chunk),
      chunkSize: MAX_ITEMS_IN_DESCRIBE_REQUEST,
    })).result
  }

  /**
   * Create or update a salesforce object
   * @param type The metadata type of the components to be created or updated
   * @param metadata The metadata of the object
   * @returns The save result of the requested creation
   */
  @SalesforceClient.logDecorator(['fullName'])
  @validateSaveResult
  @SalesforceClient.requiresLogin
  public async upsert(type: string, metadata: MetadataInfo | MetadataInfo[]):
    Promise<UpsertResult[]> {
    const result = await sendChunked({
      operationInfo: `upsert (${type})`,
      input: metadata,
      sendChunk: chunk => this.conn.metadata.upsert(type, chunk),
    })
    log.debug('upsert %o of type %s [result=%o]', makeArray(metadata).map(f => f.fullName),
      type, result.result)
    return result.result
  }

  /**
   * Deletes salesforce client
   * @param type The metadata type of the components to be deleted
   * @param fullNames The full names of the metadata components
   * @returns The save result of the requested deletion
   */
  @SalesforceClient.logDecorator()
  @validateDeleteResult
  @SalesforceClient.requiresLogin
  public async delete(type: string, fullNames: string | string[]): Promise<SaveResult[]> {
    const result = await sendChunked({
      operationInfo: `delete (${type})`,
      input: fullNames,
      sendChunk: chunk => this.conn.metadata.delete(type, chunk),
    })
    log.debug('deleted %o of type %s [result=%o]', fullNames, type, result.result)
    return result.result
  }

  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async retrieve(retrieveRequest: RetrieveRequest): Promise<RetrieveResult> {
    return flatValues(await this.conn.metadata.retrieve(retrieveRequest).complete())
  }

  /**
   * Updates salesforce metadata with the Deploy API
   * @param zip The package zip
   * @returns The save result of the requested update
   */
  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async deploy(zip: Buffer): Promise<DeployResult> {
    const defaultDeployOptions = { rollbackOnError: true, ignoreWarnings: true }
    return flatValues(
      await this.conn.metadata.deploy(
        zip,
        _.merge(defaultDeployOptions, this.config?.deploy),
      ).complete(true)
    )
  }

  /**
   * Queries for all the available Records given a query string
   * @param queryString the string to query with for records
   */
  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async *queryAll(
    queryString: string,
    useToolingApi = false,
  ): AsyncIterable<SalesforceRecord[]> {
    const hadMore = (results: QueryResult<Value>): boolean =>
      !_.isUndefined(results.nextRecordsUrl)

    const conn = useToolingApi ? this.conn.tooling : this.conn
    let results = await conn.query(queryString)
    yield results.records as SalesforceRecord[]

    let hasMore = hadMore(results)
    while (hasMore) {
      // eslint-disable-next-line no-await-in-loop
      results = await conn.queryMore(results.nextRecordsUrl as string)
      yield results.records as SalesforceRecord[]
      hasMore = hadMore(results)
    }
  }

  @SalesforceClient.logDecorator()
  @SalesforceClient.requiresLogin
  public async bulkLoadOperation(
    type: string,
    operation: BulkLoadOperation,
    records: SalesforceRecord[]
  ):
    Promise<BatchResultInfo[]> {
    const batch = this.conn.bulk.load(
      type,
      operation,
      { extIdField: CUSTOM_OBJECT_ID_FIELD, concurrencyMode: 'Parallel' },
      records
    )
    const { job } = batch
    await new Promise(resolve => job.on('close', resolve))
    const result = await batch.then() as BatchResultInfo[]
    return flatValues(result)
  }
}
