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
import { EOL } from 'os'
import requestretry, { RequestRetryOptions, RetryStrategies, RetryStrategy } from 'requestretry'
import Bottleneck from 'bottleneck'
import { collections, decorators, hash } from '@salto-io/lowerdash'
import {
  BatchResultInfo,
  BulkLoadOperation,
  Connection as RealConnection,
  DeployOptions as JSForceDeployOptions,
  DeployResult,
  DescribeGlobalSObjectResult,
  DescribeSObjectResult,
  DescribeValueTypeResult,
  FileProperties,
  ListMetadataQuery,
  MetadataInfo,
  MetadataObject,
  QueryResult,
  RetrieveRequest,
  RetrieveResult,
  SaveResult,
  UpsertResult,
} from 'jsforce'
import { client as clientUtils } from '@salto-io/adapter-components'
import { flatValues } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Options, RequestCallback } from 'request'
import { AccountId, CredentialError, Value } from '@salto-io/adapter-api'
import {
  CUSTOM_OBJECT_ID_FIELD,
  DEFAULT_CUSTOM_OBJECTS_DEFAULT_RETRY_OPTIONS,
  DEFAULT_MAX_CONCURRENT_API_REQUESTS,
  SALESFORCE,
} from '../constants'
import { CompleteSaveResult, SalesforceRecord, SfError } from './types'
import {
  ClientPollingConfig,
  ClientRateLimitConfig,
  ClientRetryConfig,
  Credentials,
  CustomObjectsDeployRetryConfig,
  OauthAccessTokenCredentials,
  ReadMetadataChunkSizeConfig,
  SalesforceClientConfig,
  UsernamePasswordCredentials,
} from '../types'
import Connection from './jsforce'
import { mapToUserFriendlyErrorMessages } from './user_facing_errors'
import { HANDLED_ERROR_PREDICATES } from '../config_change'

const { makeArray } = collections.array
const { toMD5 } = hash

const log = logger(module)
const { logDecorator, throttle, requiresLogin, createRateLimitersFromConfig } = clientUtils

type DeployOptions = Pick<JSForceDeployOptions, 'checkOnly'>

export const API_VERSION = '57.0'
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

const DEFAULT_RETRY_OPTS: Required<ClientRetryConfig> = {
  maxAttempts: 3, // try 3 times
  retryDelay: 5000, // wait for 5s before trying again
  retryStrategy: 'NetworkError', // retry on network errors
  timeout: 60 * 1000 * 8, // timeout per request retry in milliseconds
}

const DEFAULT_READ_METADATA_CHUNK_SIZE: Required<ReadMetadataChunkSizeConfig> = {
  default: MAX_ITEMS_IN_READ_METADATA_REQUEST,
  overrides: {
    Profile: 1,
    PermissionSet: 1,
  },
}

// This is attempting to work around issues where the Salesforce API sometimes
// returns invalid responses for no apparent reason, causing jsforce to crash.
// We hope retrying will help...
const errorMessagesToRetry = [
  'Cannot read property \'result\' of null',
  'Too many properties to enumerate',
  /**
   * We saw "unknown_error: retry your request" error message,
   * but in case there is another error that says "retry your request", probably we should retry it
   */
  'retry your request',
  'Polling time out',
  'SERVER_UNAVAILABLE',
  'system may be currently unavailable',
  'Unexpected internal servlet state',
  'socket hang up',
  'An internal server error has occurred',
  'An unexpected connection error occurred',
  'ECONNREFUSED',
  'Internal_Error',
]

type RateLimitBucketName = keyof ClientRateLimitConfig

const isAlreadyDeletedError = (error: SfError): boolean => (
  error.statusCode === 'INVALID_CROSS_REFERENCE_KEY'
  && error.message.match(/no.*named.*found/) !== null
)

export type ErrorFilter = (error: Error) => boolean

const isSFDCUnhandledException = (error: Error): boolean => (
  !HANDLED_ERROR_PREDICATES.some(predicate => predicate(error))
)

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
  config?: SalesforceClientConfig
}

const DEFAULT_POLLING_CONFIG = {
  interval: 3000,
  deployTimeout: 1000 * 60 * 90, // 90 minutes
  fetchTimeout: 1000 * 60 * 30, // 30 minutes
}

export const setPollIntervalForConnection = (
  connection: Connection,
  pollingConfig: Required<ClientPollingConfig>,
): void => {
  // Set poll interval for fetch & bulk ops (e.g. CSV deletes)
  connection.metadata.pollInterval = pollingConfig.interval
  connection.bulk.pollInterval = pollingConfig.interval
}

export const createRequestModuleFunction = (retryOptions: RequestRetryOptions) =>
  (opts: Options, callback: RequestCallback) =>
    requestretry({ ...retryOptions, ...opts }, (err, response, body) => {
      const attempts = _.get(response, 'attempts') || _.get(err, 'attempts')
      if (attempts && attempts > 1) {
        log.warn('sfdc client retry attempts: %o', attempts)
      }
      // Temp code to check to have more details to fix https://salto-io.atlassian.net/browse/SALTO-1600
      // response can be undefined when there was an error
      if (response !== undefined && !response.request.path.startsWith('/services/Soap')) {
        log.debug('Received headers: %o from request to path: %s', response.headers, response.request.path)
      }
      return callback(err, response, body)
    })

type OauthConnectionParams = {
  instanceUrl: string
  accessToken: string
  refreshToken: string
  retryOptions: RequestRetryOptions
  clientId: string
  clientSecret: string
  isSandbox: boolean
}

const oauthConnection = (params: OauthConnectionParams): Connection => {
  log.debug('creating OAuth connection', {
    instanceUrl: params.instanceUrl,
    accessToken: toMD5(params.accessToken),
    refreshToken: toMD5(params.refreshToken),
  })

  const conn = new RealConnection({
    oauth2: {
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      loginUrl: params.isSandbox ? 'https://test.salesforce.com' : 'https://login.salesforce.com',
    },
    version: API_VERSION,
    instanceUrl: params.instanceUrl,
    accessToken: params.accessToken,
    refreshToken: params.refreshToken,
    requestModule: createRequestModuleFunction(params.retryOptions),
  })

  conn.on('refresh', accessToken => {
    log.debug('accessToken has been refreshed', { accessToken: toMD5(accessToken) })
  })

  return conn
}

const realConnection = (
  isSandbox: boolean,
  retryOptions: RequestRetryOptions,
): Connection => (
  new RealConnection({
    version: API_VERSION,
    loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`,
    requestModule: createRequestModuleFunction(retryOptions),
  })
)

type SendChunkedArgs<TIn, TOut> = {
  input: TIn | TIn[]
  sendChunk: (chunk: TIn[]) => Promise<TOut | TOut[]>
  operationInfo: string
  chunkSize?: number
  isSuppressedError?: ErrorFilter
  isUnhandledError?: ErrorFilter
}

type SendChunkedError<TIn> = {
  input: TIn
  error: Error
}

export type SendChunkedResult<TIn, TOut> = {
  result: TOut[]
  errors: SendChunkedError<TIn>[]
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
      log.debug('Sending chunked %s on %o', operationInfo, chunkInput)
      const result = makeArray(await sendChunk(chunkInput)).map(flatValues)
      if (chunkSize === 1 && chunkInput.length > 0) {
        log.debug('Finished %s on %o', operationInfo, chunkInput[0])
      }
      return { result, errors: [] }
    } catch (error) {
      if (chunkInput.length > 1) {
        // Try each input individually to single out the one that caused the error
        log.warn('chunked %s failed on chunk with error: %s. Message: %s. Trying each element separately.',
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
        log.warn('chunked %s unrecoverable error on %o: %o',
          operationInfo, chunkInput[0], error)
        throw error
      }
      log.warn('chunked %s unknown error on %o: %o',
        operationInfo, chunkInput[0], error)
      return { result: [], errors: chunkInput.map(i => ({ input: i, error })) }
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

const retry400ErrorWrapper = (strategy: RetryStrategy): RetryStrategy =>
  (err, response, body) => {
    if (strategy(err, response, body)) {
      return true
    }
    if (response.statusCode === 400) {
      log.trace(`Retrying on 400 due to known salesforce issues. Err: ${err}`)
      return true
    }
    return false
  }
const createRetryOptions = (retryOptions: Required<ClientRetryConfig>): RequestRetryOptions => ({
  maxAttempts: retryOptions.maxAttempts,
  retryStrategy: retry400ErrorWrapper(RetryStrategies[retryOptions.retryStrategy]),
  timeout: retryOptions.timeout,
  delayStrategy: (err, _response, _body) => {
    log.warn('failed to run SFDC call for reason: %s. Retrying in %ss.',
      err?.message ?? '', (retryOptions.retryDelay / 1000))
    return retryOptions.retryDelay
  },
})

const createConnectionFromCredentials = (
  creds: Credentials,
  options: RequestRetryOptions,
): Connection => {
  if (creds instanceof OauthAccessTokenCredentials) {
    try {
      return oauthConnection({
        instanceUrl: creds.instanceUrl,
        accessToken: creds.accessToken,
        refreshToken: creds.refreshToken,
        retryOptions: options,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        isSandbox: creds.isSandbox,
      })
    } catch (error) {
      throw new CredentialError(error.message)
    }
  }
  return realConnection(creds.isSandbox, options)
}

const retryOnBadResponse = async <T extends object>(
  request: () => Promise<T>,
  retryAttempts = DEFAULT_RETRY_OPTS.maxAttempts,
): Promise<T> => {
  const requestWithRetry = async (attempts: number): Promise<T> => {
    let res: T
    try {
      res = await request()
    } catch (e) {
      log.warn(`caught exception: ${e.message}. ${attempts} retry attempts left from ${retryAttempts} in total`)
      if (attempts > 1 && errorMessagesToRetry.some(message => e.message.includes(message))) {
        log.warn('Encountered invalid result from salesforce, error message: %s, will retry %d more times', e.message, attempts - 1)
        return requestWithRetry(attempts - 1)
      }
      throw e
    }

    if (typeof res === 'string') {
      log.warn('Received string when expected object, attempting the json parse the received string')

      try {
        return JSON.parse(res)
      } catch (e) {
        log.warn('Received string that is not json parsable when expected object. Retries left %d', attempts - 1)
        if (attempts > 1) {
          return requestWithRetry(attempts - 1)
        }
        throw e
      }
    }

    return res
  }
  return requestWithRetry(retryAttempts)
}

export const loginFromCredentialsAndReturnOrgId = async (
  connection: Connection, creds: Credentials): Promise<string> => {
  if (creds instanceof UsernamePasswordCredentials) {
    try {
      return (await connection.login(creds.username, creds.password + (creds.apiToken ?? ''))).organizationId
    } catch (error) {
      throw new CredentialError(error.message)
    }
  }
  // Oauth connection doesn't require further login
  const identityInfo = await retryOnBadResponse(() => connection.identity())
  log.debug(`connected salesforce user: ${identityInfo.username}`, { identityInfo })

  return identityInfo.organization_id
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
  const conn = connection || createConnectionFromCredentials(creds, options)
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
  private readonly retryOptions: RequestRetryOptions
  private readonly conn: Connection
  private isLoggedIn = false
  private readonly credentials: Credentials
  private readonly config?: SalesforceClientConfig
  private readonly setFetchPollingTimeout: () => void
  private readonly setDeployPollingTimeout: () => void
  readonly rateLimiters: Record<RateLimitBucketName, Bottleneck>
  readonly dataRetry: CustomObjectsDeployRetryConfig
  readonly clientName: string
  readonly readMetadataChunkSize: Required<ReadMetadataChunkSizeConfig>

  constructor(
    { credentials, connection, config }: SalesforceClientOpts
  ) {
    this.credentials = credentials
    this.config = config
    this.retryOptions = createRetryOptions(_.defaults({}, config?.retry, DEFAULT_RETRY_OPTS))
    this.conn = connection ?? createConnectionFromCredentials(
      credentials,
      this.retryOptions,
    )
    const pollingConfig = _.defaults({}, config?.polling, DEFAULT_POLLING_CONFIG)
    this.setFetchPollingTimeout = () => {
      this.conn.metadata.pollTimeout = pollingConfig.fetchTimeout
      this.conn.bulk.pollTimeout = pollingConfig.fetchTimeout
    }
    this.setDeployPollingTimeout = () => {
      this.conn.metadata.pollTimeout = pollingConfig.deployTimeout
      this.conn.bulk.pollTimeout = pollingConfig.deployTimeout
    }

    setPollIntervalForConnection(this.conn, pollingConfig)
    this.setFetchPollingTimeout()
    this.rateLimiters = createRateLimitersFromConfig({
      rateLimit: _.defaults(
        {}, config?.maxConcurrentApiRequests, DEFAULT_MAX_CONCURRENT_API_REQUESTS,
      ),
      clientName: SALESFORCE,
    })
    this.dataRetry = config?.dataRetry ?? DEFAULT_CUSTOM_OBJECTS_DEFAULT_RETRY_OPTIONS
    this.clientName = 'SFDC'
    this.readMetadataChunkSize = _.merge(
      {},
      DEFAULT_READ_METADATA_CHUNK_SIZE,
      config?.readMetadataChunkSize,
    )
  }

  private retryOnBadResponse = <T extends object>(request: () => Promise<T>): Promise<T> => {
    const retryAttempts = this.retryOptions.maxAttempts ?? DEFAULT_RETRY_OPTS.maxAttempts
    return retryOnBadResponse(request, retryAttempts)
  }


  async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      await loginFromCredentialsAndReturnOrgId(this.conn, this.credentials)
      this.isLoggedIn = true
    }
  }

  isSandbox(): boolean {
    return this.credentials.isSandbox
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'query' })
  @logDecorator()
  @requiresLogin()
  public async countInstances(typeName: string) : Promise<number> {
    const countResult = await this.conn.query(`SELECT COUNT() FROM ${typeName}`)
    return countResult.totalSize
  }

  /**
   * Extract metadata object names
   */
  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'describe' })
  @logDecorator()
  @requiresLogin()
  public async listMetadataTypes(): Promise<MetadataObject[]> {
    const describeResult = await this.retryOnBadResponse(() => this.conn.metadata.describe())
    return flatValues((describeResult).metadataObjects)
  }

  /**
   * Read information about a value type
   * @param type The name of the metadata type for which you want metadata
   */
  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'describe' })
  @logDecorator()
  @requiresLogin()
  public async describeMetadataType(type: string): Promise<DescribeValueTypeResult> {
    const fullName = `{${METADATA_NAMESPACE}}${type}`
    const describeResult = await this.retryOnBadResponse(
      () => this.conn.metadata.describeValueType(fullName)
    )
    return flatValues(describeResult)
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'list', keys: ['type', '0.type'] })
  @logDecorator(['type', '0.type'])
  @requiresLogin()
  public async listMetadataObjects(
    listMetadataQuery: ListMetadataQuery | ListMetadataQuery[],
    isUnhandledError: ErrorFilter = isSFDCUnhandledException,
  ): Promise<SendChunkedResult<ListMetadataQuery, FileProperties>> {
    return sendChunked({
      operationInfo: 'listMetadataObjects',
      input: listMetadataQuery,
      sendChunk: chunk => this.retryOnBadResponse(() => this.conn.metadata.list(chunk)),
      chunkSize: MAX_ITEMS_IN_LIST_METADATA_REQUEST,
      isUnhandledError,
    })
  }

  @mapToUserFriendlyErrorMessages
  @requiresLogin()
  public async getUrl(): Promise<URL | undefined> {
    try {
      return new URL(this.conn.instanceUrl)
    } catch (e) {
      log.error(`Caught exception when tried to parse salesforce url: ${e.stack}`)
      return undefined
    }
  }

  /**
   * Read metadata for salesforce object of specific type and name
   */
  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'read' })
  @logDecorator(
    [],
    args => {
      const arg = args[1]
      return (_.isArray(arg) ? arg : [arg]).length.toString()
    },
  )
  @requiresLogin()
  public async readMetadata(
    type: string,
    name: string | string[],
    isUnhandledError: ErrorFilter = isSFDCUnhandledException,
  ): Promise<SendChunkedResult<string, MetadataInfo>> {
    return sendChunked({
      operationInfo: `readMetadata (${type})`,
      input: name,
      sendChunk: chunk => this.retryOnBadResponse(() => this.conn.metadata.read(type, chunk)),
      chunkSize: this.readMetadataChunkSize.overrides[type] ?? this.readMetadataChunkSize.default,
      isSuppressedError: error => (
        // This seems to happen with actions that relate to sending emails - these are disabled in
        // some way on sandboxes and for some reason this causes the SF API to fail reading
        (this.credentials.isSandbox && type === 'QuickAction' && error.message === 'targetObject is invalid')
        || (error.name === 'sf:INSUFFICIENT_ACCESS')
        // Seems that reading TopicsForObjects for Problem, Incident and ChangeRequest fails.
        // Unclear why this happens, might be a SF API bug, suppressing as this seems unimportant
        || (type === 'TopicsForObjects' && error.name === 'sf:INVALID_TYPE_FOR_OPERATION')
      ),
      isUnhandledError,
    })
  }

  /**
   * Extract sobject names
   */
  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'describe' })
  @logDecorator()
  @requiresLogin()
  public async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    return flatValues((await this.retryOnBadResponse(() => this.conn.describeGlobal())).sobjects)
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'describe' })
  @logDecorator()
  @requiresLogin()
  public async describeSObjects(objectNames: string[]):
  Promise<SendChunkedResult<string, DescribeSObjectResult>> {
    return sendChunked({
      operationInfo: 'describeSObjects',
      input: objectNames,
      sendChunk: chunk => this.retryOnBadResponse(() => this.conn.soap.describeSObjects(chunk)),
      chunkSize: MAX_ITEMS_IN_DESCRIBE_REQUEST,
    })
  }

  /**
   * Create or update a salesforce object
   * @param type The metadata type of the components to be created or updated
   * @param metadata The metadata of the object
   * @returns The save result of the requested creation
   */
  @mapToUserFriendlyErrorMessages
  @logDecorator(['fullName'])
  @validateSaveResult
  @requiresLogin()
  public async upsert(type: string, metadata: MetadataInfo | MetadataInfo[]):
    Promise<UpsertResult[]> {
    const result = await sendChunked({
      operationInfo: `upsert (${type})`,
      input: metadata,
      sendChunk: chunk => this.retryOnBadResponse(() => this.conn.metadata.upsert(type, chunk)),
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
  @mapToUserFriendlyErrorMessages
  @logDecorator()
  @validateDeleteResult
  @requiresLogin()
  public async delete(type: string, fullNames: string | string[]): Promise<SaveResult[]> {
    const result = await sendChunked({
      operationInfo: `delete (${type})`,
      input: fullNames,
      sendChunk: chunk => this.retryOnBadResponse(() => this.conn.metadata.delete(type, chunk)),
    })
    log.debug('deleted %o of type %s [result=%o]', fullNames, type, result.result)
    return result.result
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'retrieve' })
  @logDecorator()
  @requiresLogin()
  public async retrieve(retrieveRequest: RetrieveRequest): Promise<RetrieveResult> {
    return flatValues(
      await this.retryOnBadResponse(() => this.conn.metadata.retrieve(retrieveRequest).complete())
    )
  }

  /**
   * Updates salesforce metadata with the Deploy API
   * @param zip The package zip
   * @param deployOptions Salesforce deployment options
   * @returns The save result of the requested update
   */
  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'deploy' })
  @logDecorator()
  @requiresLogin()
  public async deploy(zip: Buffer, deployOptions?: DeployOptions): Promise<DeployResult> {
    this.setDeployPollingTimeout()
    const defaultDeployOptions = { rollbackOnError: true, ignoreWarnings: true }
    const { checkOnly = false } = deployOptions ?? {}
    const optionsToSend = ['rollbackOnError', 'ignoreWarnings', 'purgeOnDelete', 'testLevel', 'runTests']
    const deployResult = flatValues(
      await this.conn.metadata.deploy(
        zip,
        {
          ...defaultDeployOptions,
          ..._.pick(this.config?.deploy, optionsToSend),
          checkOnly,
        },
      ).complete(true)
    )
    this.setFetchPollingTimeout()
    return deployResult
  }

  /**
   * preform quick deploy to salesforce metadata
   * @param validationId The package zip
   * @returns The save result of the requested update
   */
  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'deploy' })
  @logDecorator()
  @requiresLogin()
  public async quickDeploy(validationId: string): Promise<DeployResult> {
    this.setDeployPollingTimeout()
    const deployResult = flatValues(await this.conn.metadata.deployRecentValidation(
      validationId
    ).complete(true))
    this.setFetchPollingTimeout()
    return deployResult
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'query' })
  @logDecorator()
  @requiresLogin()
  private query<T>(queryString: string, useToolingApi: boolean): Promise<QueryResult<T>> {
    const conn = useToolingApi ? this.conn.tooling : this.conn
    return this.retryOnBadResponse(() => conn.query(queryString))
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'query' })
  @logDecorator()
  @requiresLogin()
  private queryMore<T>(queryString: string, useToolingApi: boolean): Promise<QueryResult<T>> {
    const conn = useToolingApi ? this.conn.tooling : this.conn
    return this.retryOnBadResponse(() => conn.queryMore(queryString))
  }

  /**
   * Queries for all the available Records given a query string
   *
   * This function should be called after logging in
   *
   * @param queryString the string to query with for records
   */
  private async *getQueryAllIterable(
    queryString: string,
    useToolingApi = false,
  ): AsyncIterable<SalesforceRecord[]> {
    const hadMore = (results: QueryResult<Value>): boolean =>
      !_.isUndefined(results.nextRecordsUrl)

    let results = await this.query(queryString, useToolingApi)
    if (results.records === undefined) {
      log.warn('could not find records in queryAll response for query(\'%s\', %s), response: %o', queryString, useToolingApi, results)
      return
    }
    yield results.records as SalesforceRecord[]

    let hasMore = hadMore(results)
    while (hasMore) {
      const nextRecordsUrl = results.nextRecordsUrl as string
      // eslint-disable-next-line no-await-in-loop
      results = await this.queryMore(nextRecordsUrl, useToolingApi)
      if (results.records === undefined) {
        log.warn('could not find records in queryAll response for queryMore(\'%s\', %s), response: %o', queryString, useToolingApi, results)
        break
      }
      yield results.records as SalesforceRecord[]
      hasMore = hadMore(results)
    }
  }

  /**
   * Queries for all the available Records given a query string
   * @param queryString the string to query with for records
   */
  @mapToUserFriendlyErrorMessages
  @requiresLogin()
  public async queryAll(
    queryString: string,
    useToolingApi = false,
  ): Promise<AsyncIterable<SalesforceRecord[]>> {
    return this.getQueryAllIterable(queryString, useToolingApi)
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'deploy' })
  @logDecorator()
  @requiresLogin()
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
