/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { EOL } from 'os'
import requestretry, { RequestRetryOptions, RetryStrategies, RetryStrategy } from 'requestretry'
import { collections, decorators, hash } from '@salto-io/lowerdash'
import {
  BatchResultInfo,
  BulkLoadOperation,
  Connection as RealConnection,
  DeployOptions as JSForceDeployOptions,
  DeployResult,
  DeployResultLocator,
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
} from '@salto-io/jsforce'
import { client as clientUtils } from '@salto-io/adapter-components'
import { flatValues, inspectValue } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { Options, RequestCallback } from 'request'
import {
  AccountInfo,
  CancelServiceAsyncTaskInput,
  CancelServiceAsyncTaskResult,
  CredentialError,
  Value,
} from '@salto-io/adapter-api'
import {
  CUSTOM_OBJECT_ID_FIELD,
  DEFAULT_CUSTOM_OBJECTS_DEFAULT_RETRY_OPTIONS,
  DEFAULT_MAX_CONCURRENT_API_REQUESTS,
  SALESFORCE,
} from '../constants'
import { CompleteSaveResult, SalesforceRecord, SfError } from './types'
import {
  ClientDeployConfig,
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
import { getFullName } from '../filters/utils'

const { makeArray } = collections.array
const { toMD5 } = hash

const log = logger(module)
const { logDecorator, throttle, requiresLogin, createRateLimitersFromConfig } = clientUtils

type DeployOptions = Pick<JSForceDeployOptions, 'checkOnly'>

export const API_VERSION = '62.0'
const METADATA_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

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

const errorCodesToRetry = [400, 406]

// This is attempting to work around issues where the Salesforce API sometimes
// returns invalid responses for no apparent reason, causing jsforce to crash.
// We hope retrying will help...
const errorMessagesToRetry = [
  "Cannot read property 'result' of null",
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
  'UNABLE_TO_LOCK_ROW', // we saw this in both fetch and deploy
  'no healthy upstream',
  'upstream connect error or disconnect/reset before headers',
  'security policies took too long to evaluate',
  // The following are from the force.com source code, we did not encounter them ourselves:
  // ref: https://github.com/forcedotcom/source-deploy-retrieve/blob/f7881c94d46aad5e67005af1802f7b66bd0b26f4/src/client/metadataTransfer.ts#L207-L228
  'ENOMEM',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNRESET',
  'connection timeout',
  'INVALID_QUERY_LOCATOR',
  'ERROR_HTTP_502',
  'ERROR_HTTP_503',
  '<h1>Bad Message 400</h1><pre>reason: Bad Request</pre>',
  'Unable to complete the creation of the query cursor at this time',
  'Failed while fetching query cursor data for this QueryLocator',
  'Client network socket disconnected before secure TLS connection was established',
  'Unexpected internal servlet state',
  // end of force.com error messages
  'ERROR_HTTP_420',
  'down for maintenance',
  'REQUEST_RUNNING_TOO_LONG',
  'request exceeded the time limit for processing',
  'INVALID_LOCATOR',
  'FUNCTIONALITY_TEMPORARILY_UNAVAILABLE',
]

type RateLimitBucketName = keyof ClientRateLimitConfig

const isAlreadyDeletedError = (error: SfError): boolean =>
  error.statusCode === 'INVALID_CROSS_REFERENCE_KEY' && error.message.match(/no.*named.*found/) !== null

export type ErrorFilter = (error: Error) => boolean

const isSFDCUnhandledException = (error: Error): boolean =>
  !HANDLED_ERROR_PREDICATES.some(predicate => predicate(error))

const validateCRUDResult = (isDelete: boolean): decorators.InstanceMethodDecorator =>
  decorators.wrapMethodWith(async (original: decorators.OriginalCall): Promise<unknown> => {
    const result = await original.call()

    const errors = _(makeArray(result))
      .filter(r => r)
      .map(r => r as CompleteSaveResult)
      .map(r => makeArray(r.errors))
      .flatten()
      .value()

    const [silencedErrors, realErrors] = _.partition(errors, err => isDelete && isAlreadyDeletedError(err))
    if (silencedErrors.length > 0) {
      log.debug('ignoring errors:%s%s', EOL, silencedErrors.map(e => e.message).join(EOL))
    }
    if (realErrors.length > 0) {
      throw new Error(realErrors.map(e => e.message).join(EOL))
    }

    return result
  })

const validateDeleteResult = validateCRUDResult(true)
const validateSaveResult = validateCRUDResult(false)

type SalesforceClientOpts = {
  credentials: Credentials
  connection?: Connection
  config?: SalesforceClientConfig
}

const DEFAULT_POLLING_CONFIG = {
  interval: 3000,
  deployTimeout: 1000 * 60 * 90, // 90 minutes
  fetchTimeout: 1000 * 60 * 30, // 30 minutes
}

const setPollIntervalForConnection = (connection: Connection, pollingConfig: Required<ClientPollingConfig>): void => {
  // Set poll interval for fetch & bulk ops (e.g. CSV deletes)
  connection.metadata.pollInterval = pollingConfig.interval
  connection.bulk.pollInterval = pollingConfig.interval
}

const createRequestModuleFunction = (retryOptions: RequestRetryOptions) => (opts: Options, callback: RequestCallback) =>
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
    if (!_.isString(accessToken)) {
      log.warn('Got a non string access token: %s', inspectValue(accessToken))
      return
    }
    log.debug('accessToken has been refreshed', {
      accessToken: toMD5(accessToken),
    })
  })

  return conn
}

const realConnection = (isSandbox: boolean, retryOptions: RequestRetryOptions): Connection =>
  new RealConnection({
    version: API_VERSION,
    loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`,
    requestModule: createRequestModuleFunction(retryOptions),
  })

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

type SendChunkedResult<TIn, TOut> = {
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
  const sendSingleChunk = async (chunkInput: TIn[]): Promise<SendChunkedResult<TIn, TOut>> => {
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
        log.warn(
          'chunked %s failed on chunk with error: %s. Message: %s. Trying each element separately.',
          operationInfo,
          error.name,
          error.message,
        )
        const sendChunkResult = await Promise.all(chunkInput.map(item => sendSingleChunk([item])))
        return {
          result: _.flatten(sendChunkResult.map(e => e.result).map(flatValues)),
          errors: _.flatten(sendChunkResult.map(e => e.errors)),
        }
      }
      if (isSuppressedError(error)) {
        log.warn('chunked %s ignoring recoverable error on %o: %s', operationInfo, chunkInput[0], error.message)
        return { result: [], errors: [] }
      }
      if (isUnhandledError(error)) {
        log.warn('chunked %s unrecoverable error on %o: %o', operationInfo, chunkInput[0], error)
        throw error
      }
      log.warn('chunked %s unknown error on %o: %o', operationInfo, chunkInput[0], error)
      return {
        result: [],
        errors: chunkInput.map(i => ({ input: i, error })),
      }
    }
  }
  const result = await Promise.all(
    _.chunk(makeArray(input), chunkSize)
      .filter(chunk => !_.isEmpty(chunk))
      .map(sendSingleChunk),
  )
  return {
    result: _.flatten(result.map(e => e.result)),
    errors: _.flatten(result.map(e => e.errors)),
  }
}

export class ApiLimitsTooLowError extends Error {}

const retryErrorsByCodeWrapper =
  (strategy: RetryStrategy): RetryStrategy =>
  (err, response, body) => {
    if (strategy(err, response, body)) {
      return true
    }
    if (errorCodesToRetry.some(code => response.statusCode === code)) {
      log.warn(
        `Retrying on ${response.statusCode} due to known salesforce issues. Err: ${err}, headers: ${response.headers}, status message: ${response.statusMessage}, body: ${body}`,
      )
      return true
    }
    return false
  }
const createRetryOptions = (retryOptions: Required<ClientRetryConfig>): RequestRetryOptions => ({
  maxAttempts: retryOptions.maxAttempts,
  retryStrategy: retryErrorsByCodeWrapper(RetryStrategies[retryOptions.retryStrategy]),
  timeout: retryOptions.timeout,
  delayStrategy: (err, _response, _body) => {
    log.warn(
      'failed to run SFDC call for reason: %s. Retrying in %ss.',
      err?.message ?? '',
      retryOptions.retryDelay / 1000,
    )
    return retryOptions.retryDelay
  },
})

const createConnectionFromCredentials = (credentials: Credentials, options: RequestRetryOptions): Connection => {
  if (credentials instanceof OauthAccessTokenCredentials) {
    try {
      return oauthConnection({
        instanceUrl: credentials.instanceUrl,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        retryOptions: options,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        isSandbox: credentials.isSandbox,
      })
    } catch (error) {
      throw new CredentialError(error.message)
    }
  }
  return realConnection(credentials.isSandbox, options)
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
        log.warn(
          'Encountered invalid result from salesforce, error message: %s, will retry %d more times',
          e.message,
          attempts - 1,
        )
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

const loginFromCredentialsAndReturnOrgId = async (
  connection: Connection,
  credentials: Credentials,
): Promise<string> => {
  if (credentials instanceof UsernamePasswordCredentials) {
    try {
      return (await connection.login(credentials.username, credentials.password + (credentials.apiToken ?? '')))
        .organizationId
    } catch (error) {
      throw new CredentialError(error.message)
    }
  }
  // Oauth connection doesn't require further login
  const identityInfo = await retryOnBadResponse(() => connection.identity())
  log.debug(`connected salesforce user: ${identityInfo.username}`, {
    identityInfo,
  })

  return identityInfo.organization_id
}

type OrganizationRecord = SalesforceRecord & {
  OrganizationType: string
  IsSandbox: boolean
}

const isOrganizationRecord = (record: SalesforceRecord): record is OrganizationRecord =>
  _.isString(record.OrganizationType) && _.isBoolean(record.IsSandbox)

const queryOrganization = async (conn: Connection, orgId: string): Promise<OrganizationRecord | undefined> => {
  try {
    const result = await conn.query(`SELECT OrganizationType, IsSandbox FROM Organization WHERE Id = '${orgId}'`)
    const [organizationRecord] = result.records as SalesforceRecord[]
    log.debug('organization record: %o', organizationRecord)
    return isOrganizationRecord(organizationRecord) ? organizationRecord : undefined
  } catch (e) {
    log.error('Failed to query the organization record from salesforce', e)
    return undefined
  }
}

const PRODUCTION_ACCOUNT_TYPES = [
  'Team Edition',
  'Professional Edition',
  'Enterprise Edition',
  'Personal Edition',
  'Unlimited Edition',
  'Contact Manager Edition',
  'Base Edition',
]

export const getConnectionDetails = async (
  credentials: Credentials,
  connection?: Connection,
): Promise<{
  remainingDailyRequests: number
  orgId: string
  accountType?: string
  isProduction?: boolean
  instanceUrl?: string
}> => {
  const options = {
    maxAttempts: 2,
    retryStrategy: RetryStrategies.HTTPOrNetworkError,
  }
  const conn = connection || createConnectionFromCredentials(credentials, options)
  const orgId = await loginFromCredentialsAndReturnOrgId(conn, credentials)
  const limits = await conn.limits()
  const organizationRecord = await queryOrganization(conn, orgId)
  if (organizationRecord === undefined) {
    return {
      remainingDailyRequests: limits.DailyApiRequests.Remaining,
      orgId,
    }
  }
  return {
    remainingDailyRequests: limits.DailyApiRequests.Remaining,
    orgId,
    accountType: organizationRecord.OrganizationType,
    isProduction:
      !organizationRecord.IsSandbox && PRODUCTION_ACCOUNT_TYPES.includes(organizationRecord.OrganizationType),
    instanceUrl: conn.instanceUrl,
  }
}

const getAccountID = (credentials: Credentials, orgId: string, instanceUrl?: string): string => {
  if (credentials.isSandbox) {
    if (instanceUrl === undefined) {
      throw new Error('Expected Salesforce organization URL to exist in the connection')
    }
    return instanceUrl
  }
  return orgId
}

export const validateCredentials = async (
  credentials: Credentials,
  minApiRequestsRemaining = 0,
  connection?: Connection,
): Promise<AccountInfo> => {
  const { remainingDailyRequests, orgId, accountType, isProduction, instanceUrl } = await getConnectionDetails(
    credentials,
    connection,
  )
  if (remainingDailyRequests < minApiRequestsRemaining) {
    throw new ApiLimitsTooLowError(`Remaining limits: ${remainingDailyRequests}, needed: ${minApiRequestsRemaining}`)
  }
  return {
    accountId: getAccountID(credentials, orgId, instanceUrl),
    accountUrl: instanceUrl,
    accountType,
    isProduction,
    extraInformation: { orgId },
  }
}

type DeployProgressCallback = (inProgressResult: DeployResult) => void

interface ISalesforceClient {
  ensureLoggedIn(): Promise<void>
  isSandbox(): boolean
  countInstances(typeName: string): Promise<number>
  listMetadataTypes(): Promise<MetadataObject[]>
  describeMetadataType(type: string): Promise<DescribeValueTypeResult>
  listMetadataObjects(queries: ListMetadataQuery[]): Promise<SendChunkedResult<ListMetadataQuery, FileProperties>>
  getUrl(): Promise<URL | undefined>
  readMetadata(type: string, fullNames: string[]): Promise<SendChunkedResult<string, MetadataInfo>>
  listSObjects(): Promise<DescribeGlobalSObjectResult[]>
  describeSObjects(objectNames: string[]): Promise<SendChunkedResult<string, DescribeSObjectResult>>
  upsert(type: string, metadata: MetadataInfo | MetadataInfo[]): Promise<UpsertResult[]>
  delete(type: string, fullNames: string[]): Promise<SaveResult[]>
  retrieve(retrieveRequest: RetrieveRequest): Promise<RetrieveResult>
  deploy(zip: Buffer, deployOptions: DeployOptions, progressCallback?: DeployProgressCallback): Promise<DeployResult>
  quickDeploy(validationId: string, progressCallback?: DeployProgressCallback): Promise<DeployResult>
  queryAll(queryString: string): Promise<AsyncIterable<SalesforceRecord[]>>
  bulkLoadOperation(operation: BulkLoadOperation, type: string, records: SalesforceRecord[]): Promise<BatchResultInfo[]>
  request(url: string): Promise<unknown>
  cancelMetadataValidateOrDeployTask(input: CancelServiceAsyncTaskInput): Promise<CancelServiceAsyncTaskResult>
}

type ListMetadataObjectsResult = ReturnType<ISalesforceClient['listMetadataObjects']>
type CustomListFunc = (client: ISalesforceClient) => ListMetadataObjectsResult

type CustomListFuncMode = 'partial' | 'full' | 'extendsOriginal'

export type CustomListFuncDef = {
  func: CustomListFunc
  mode: CustomListFuncMode
}

type CanceledDeployResult = {
  deployResult: {
    status: string
  }
}

const isCancelDeployResult = (result: unknown): result is CanceledDeployResult =>
  _.isString(_.get(result, ['deployResult', 'status']))

export default class SalesforceClient implements ISalesforceClient {
  private readonly retryOptions: RequestRetryOptions
  private readonly conn: Connection
  private isLoggedIn = false
  orgNamespace?: string
  private readonly credentials: Credentials
  private readonly config?: SalesforceClientConfig
  private readonly setFetchPollingTimeout: () => void
  private readonly setDeployPollingTimeout: () => void
  readonly rateLimiters: Record<RateLimitBucketName, clientUtils.RateLimiter>
  readonly dataRetry: CustomObjectsDeployRetryConfig
  readonly clientName: string
  readonly readMetadataChunkSize: Required<ReadMetadataChunkSizeConfig>
  readonly listedInstancesByType: collections.map.DefaultMap<string, Set<string>>
  private readonly listMetadataObjectsOfTypePromises: Record<string, ListMetadataObjectsResult>

  private readonly fullListPromisesByType: Record<string, ListMetadataObjectsResult>
  private customListFuncDefByType: Record<string, CustomListFuncDef>

  constructor({ credentials, connection, config }: SalesforceClientOpts) {
    this.customListFuncDefByType = {}
    this.credentials = credentials
    this.config = config
    this.retryOptions = createRetryOptions(_.defaults({}, config?.retry, DEFAULT_RETRY_OPTS))
    this.conn = connection ?? createConnectionFromCredentials(credentials, this.retryOptions)
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
      rateLimit: _.defaults({}, config?.maxConcurrentApiRequests, DEFAULT_MAX_CONCURRENT_API_REQUESTS),
      clientName: SALESFORCE,
    })
    this.dataRetry = config?.dataRetry ?? DEFAULT_CUSTOM_OBJECTS_DEFAULT_RETRY_OPTIONS
    this.clientName = 'SFDC'
    this.readMetadataChunkSize = _.merge({}, DEFAULT_READ_METADATA_CHUNK_SIZE, config?.readMetadataChunkSize)
    this.listMetadataObjectsOfTypePromises = {}
    this.fullListPromisesByType = {}
    this.listedInstancesByType = new collections.map.DefaultMap(() => new Set())
  }

  public setCustomListFuncDefByType(customListFuncDefByType: typeof this.customListFuncDefByType): void {
    this.customListFuncDefByType = _.mapValues(customListFuncDefByType, def => ({
      func:
        def.mode !== 'full'
          ? def.func
          : // Populate the listedInstancesByType for non-partial custom list functions
            async (client: ISalesforceClient) =>
              def.func(client).then(result => this.populateListedInstancesByType(result)),
      mode: def.mode,
    }))
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
  public async countInstances(typeName: string): Promise<number> {
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
    log.trace('listMetadataTypes result: %s', inspectValue(describeResult, { maxArrayLength: null }))
    this.orgNamespace = describeResult.organizationNamespace
    log.debug('org namespace: %s', this.orgNamespace)
    return flatValues(describeResult.metadataObjects)
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
    const describeResult = await this.retryOnBadResponse(() => this.conn.metadata.describeValueType(fullName))
    return flatValues(describeResult)
  }

  private populateListedInstancesByType(
    listResult: SendChunkedResult<ListMetadataQuery, FileProperties>,
  ): SendChunkedResult<ListMetadataQuery, FileProperties> {
    if (listResult.errors.length === 0) {
      listResult.result.forEach(fileProps => {
        this.listedInstancesByType.get(fileProps.type).add(getFullName(fileProps))
      })
    }
    return listResult
  }

  private async sendChunkedList(input: ListMetadataQuery[], isUnhandledError: ErrorFilter): ListMetadataObjectsResult {
    return sendChunked({
      operationInfo: 'listMetadataObjects',
      input,
      sendChunk: chunk => this.retryOnBadResponse(() => this.conn.metadata.list(chunk)),
      chunkSize: MAX_ITEMS_IN_LIST_METADATA_REQUEST,
      isUnhandledError,
    }).then(result => this.populateListedInstancesByType(result))
  }

  private async listMetadataObjectsOfType(
    type: string,
    isUnhandledError: ErrorFilter = isSFDCUnhandledException,
  ): ListMetadataObjectsResult {
    const existingRequest = this.listMetadataObjectsOfTypePromises[type]
    if (existingRequest !== undefined) {
      return existingRequest
    }
    const customListFuncDef: CustomListFuncDef | undefined = this.customListFuncDefByType[type]
    let request: Promise<SendChunkedResult<ListMetadataQuery, FileProperties>>
    if (customListFuncDef !== undefined) {
      // For partial custom list functions we run an additional full list request
      if (customListFuncDef.mode === 'partial') {
        this.fullListPromisesByType[type] = this.sendChunkedList([{ type }], isUnhandledError)
      }
      request = customListFuncDef.func(this).catch(e => {
        log.error(
          'Failed to run custom list function for type %s. Falling back to full list. Error: %s',
          type,
          inspectValue(e),
        )
        return this.fullListPromisesByType[type] ?? this.sendChunkedList([{ type }], isUnhandledError)
      })
      // In this mode, we run the original list function and then extend the result with the custom list function result
      if (customListFuncDef.mode === 'extendsOriginal') {
        const [originalListResult, customListResult] = await Promise.all([
          this.sendChunkedList([{ type }], isUnhandledError),
          request,
        ])
        const listedFullNames = new Set(originalListResult.result.map(props => props.fullName))
        const result = {
          result: originalListResult.result.concat(
            customListResult.result.filter(props => !listedFullNames.has(props.fullName)),
          ),
          errors: originalListResult.errors.concat(customListResult.errors),
        }
        request = Promise.resolve(result)
        this.populateListedInstancesByType(result)
      }
    } else {
      request = this.sendChunkedList([{ type }], isUnhandledError)
    }
    this.listMetadataObjectsOfTypePromises[type] = request
    return request
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({
    bucketName: 'list',
    keys: ['type', '0.type'],
  })
  @logDecorator(['type', '0.type'])
  @requiresLogin()
  public async listMetadataObjects(
    listMetadataQuery: ListMetadataQuery | ListMetadataQuery[],
    isUnhandledError: ErrorFilter = isSFDCUnhandledException,
  ): ListMetadataObjectsResult {
    const queries = makeArray(listMetadataQuery)
    if (queries.some(query => query.folder !== undefined)) {
      // We can't cache folder queries, so we just send them all at once
      return this.sendChunkedList(queries, isUnhandledError)
    }

    const listResults = await Promise.all(
      queries.map(query => this.listMetadataObjectsOfType(query.type, isUnhandledError)),
    )
    return {
      result: listResults.flatMap(listResult => listResult.result),
      errors: listResults.flatMap(listResult => listResult.errors),
    }
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
  @logDecorator([], args => {
    const arg = args[1]
    return (_.isArray(arg) ? arg : [arg]).length.toString()
  })
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
      isSuppressedError: error =>
        // This seems to happen with actions that relate to sending emails - these are disabled in
        // some way on sandboxes and for some reason this causes the SF API to fail reading
        (this.credentials.isSandbox && type === 'QuickAction' && error.message === 'targetObject is invalid') ||
        error.name === 'sf:INSUFFICIENT_ACCESS',
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
  public async describeSObjects(objectNames: string[]): Promise<SendChunkedResult<string, DescribeSObjectResult>> {
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
  public async upsert(type: string, metadata: MetadataInfo | MetadataInfo[]): Promise<UpsertResult[]> {
    const result = await sendChunked({
      operationInfo: `upsert (${type})`,
      input: metadata,
      sendChunk: chunk => this.retryOnBadResponse(() => this.conn.metadata.upsert(type, chunk)),
    })
    log.debug(
      'upsert %o of type %s [result=%o]',
      makeArray(metadata).map(f => f.fullName),
      type,
      result.result,
    )
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
    try {
      return flatValues(await this.retryOnBadResponse(() => this.conn.metadata.retrieve(retrieveRequest).complete()))
    } catch (e) {
      const typesWithInsufficientAccess = new Set<string>()
      const instancesWithInsufficientAccess = new Set<string>()
      const errorPattern = /INSUFFICIENT_ACCESS: insufficient access rights on entity: (\w+)/g
      const matches = [...e.message.matchAll(errorPattern)]
      if (matches.length > 0) {
        if (retrieveRequest.unpackaged === undefined) throw e
        await Promise.all(
          matches.map(async match => {
            const failedType = match[1]
            typesWithInsufficientAccess.add(failedType)
            log.debug(`Failed to retrieve ${failedType} due to insufficient access rights`)
            const instancesOfFailedType =
              retrieveRequest.unpackaged?.types.find(t => t.name === failedType)?.members ?? []
            const { errors } = await sendChunked({
              input: instancesOfFailedType,
              sendChunk: chunk => this.conn.metadata.read(failedType, chunk),
              operationInfo: `readMetadata (${failedType})`,
              isUnhandledError: () => false,
            })
            errors.forEach(({ input, error }) => {
              if (errorPattern.test(error.message)) {
                instancesWithInsufficientAccess.add(input[0])
              }
            })
          }),
        )
        retrieveRequest.unpackaged.types =
          retrieveRequest.unpackaged?.types.map(type => {
            if (typesWithInsufficientAccess.has(type.name)) {
              type.members = type.members.filter(member => !instancesWithInsufficientAccess.has(member))
            }
            return type
          }) ?? []
      }
      return this.retrieve(retrieveRequest)
    }
  }

  private async reportDeployProgressUntilComplete(
    deployStatus: DeployResultLocator<DeployResult>,
    progressCallback: (inProgressResult: DeployResult) => void,
  ): Promise<DeployResult> {
    const progressCallbackWrapper = async (): Promise<void> => {
      const partialResult = await deployStatus.check()
      try {
        const detailedResult = await this.conn.metadata.checkDeployStatus(partialResult.id, true)
        progressCallback(detailedResult)
      } catch (e) {
        log.warn('checkDeployStatus API call failed. Progress update will not take place. Error: %s', e.message)
      }
    }
    const pollingInterval = setInterval(() => {
      progressCallbackWrapper().catch(error => {
        log.error('Error occurred in DeployProgress callback:', error)
      })
    }, this.conn.metadata.pollInterval)
    const clearPollingInterval = (result: DeployResult): DeployResult => {
      clearInterval(pollingInterval)
      return result
    }
    const clearPollingIntervalOnError = (error: Error): DeployResult => {
      clearInterval(pollingInterval)
      throw error
    }
    // We can't use finally() because, despite what the type definition for jsforce says,
    // DeployResultLocator.complete() actually returns an AsyncResultLocator<T> and not a Promise<T>.
    // ref. https://github.com/jsforce/jsforce/blob/c04515846e91f84affa4eb87a7b2adb1f58bf04d/lib/api/metadata.js#L830
    return deployStatus.complete(true).then(clearPollingInterval, clearPollingIntervalOnError)
  }

  private async deployWithProgress(
    deployStatus: DeployResultLocator<DeployResult>,
    progressCallback?: DeployProgressCallback,
  ): Promise<DeployResult> {
    this.setDeployPollingTimeout()
    try {
      let deployResult: DeployResult

      if (progressCallback) {
        deployResult = await this.reportDeployProgressUntilComplete(deployStatus, progressCallback)
      } else {
        deployResult = await deployStatus.complete(true)
      }

      return flatValues(deployResult)
    } finally {
      this.setFetchPollingTimeout() // Revert the timeouts to what they were before
    }
  }

  /**
   * Updates salesforce metadata with the Deploy API
   * @param zip The package zip
   * @param deployOptions Salesforce deployment options
   * @param progressCallback A function that will be called every DEPLOY_STATUS_POLLING_INTERVAL_MS ms until the deploy
   *    completes
   * @returns The save result of the requested update
   */
  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'deploy' })
  @logDecorator()
  @requiresLogin()
  public async deploy(
    zip: Buffer,
    deployOptions?: DeployOptions,
    progressCallback?: DeployProgressCallback,
  ): Promise<DeployResult> {
    const defaultDeployOptions = { rollbackOnError: true, ignoreWarnings: true }
    const { checkOnly = false } = deployOptions ?? {}
    const optionsToSend: (keyof ClientDeployConfig)[] = [
      'rollbackOnError',
      'ignoreWarnings',
      'purgeOnDelete',
      'testLevel',
      'runTests',
      'performRetrieve',
    ]
    return this.deployWithProgress(
      this.conn.metadata.deploy(zip, {
        ...defaultDeployOptions,
        ..._.pick(this.config?.deploy, optionsToSend),
        checkOnly,
      }),
      progressCallback,
    )
  }

  @mapToUserFriendlyErrorMessages
  @logDecorator(['taskId'])
  @requiresLogin()
  public async cancelMetadataValidateOrDeployTask({
    taskId,
  }: CancelServiceAsyncTaskInput): Promise<CancelServiceAsyncTaskResult> {
    try {
      const deploymentStatus = await this.conn.metadata.checkDeployStatus(taskId)
      if (deploymentStatus.done) {
        log.debug('Deployment with id %s is already done, no need to cancel', taskId)
        return { errors: [] }
      }
      const cancelDeployResult = await this.conn.request({
        method: 'PATCH',
        url: `/services/data/v${API_VERSION}/metadata/deployRequest/${taskId}`,
        body: inspectValue({
          deployResult: {
            status: 'Canceling',
          },
        }),
      })
      if (!isCancelDeployResult(cancelDeployResult)) {
        return {
          errors: [
            {
              message: `Failed to cancel async deployment with id ${taskId}`,
              detailedMessage: 'Salesforce cancelDeployResult value does not contain status',
              severity: 'Error',
            },
          ],
        }
      }
      const waitUntilCanceled = async (): Promise<CancelServiceAsyncTaskResult> => {
        const deployStatus = await this.conn.metadata.checkDeployStatus(taskId)
        log.trace('waitUntilCanceled deployStatus: %s', inspectValue(deployStatus))
        if (deployStatus.done) {
          return { errors: [] }
        }
        await new Promise(resolve => setTimeout(resolve, this.conn.metadata.pollInterval))
        return waitUntilCanceled()
      }
      return await waitUntilCanceled()
    } catch (e) {
      log.error('Failed to cancel deployment with id %s: %s', taskId, inspectValue(e))
      return {
        errors: [
          {
            message: `Failed to cancel async deployment with id ${taskId}`,
            detailedMessage: e.message,
            severity: 'Error',
          },
        ],
      }
    }
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'deploy' })
  @logDecorator()
  @requiresLogin()
  public async quickDeploy(validationId: string, progressCallback?: DeployProgressCallback): Promise<DeployResult> {
    return this.deployWithProgress(this.conn.metadata.deployRecentValidation(validationId), progressCallback)
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
  private async *getQueryAllIterable(queryString: string, useToolingApi = false): AsyncIterable<SalesforceRecord[]> {
    const hadMore = (results: QueryResult<Value>): boolean => !_.isUndefined(results.nextRecordsUrl)

    let results = await this.query(queryString, useToolingApi)
    if (results.records === undefined) {
      log.warn(
        "could not find records in queryAll response for query('%s', %s), response: %o",
        queryString,
        useToolingApi,
        results,
      )
      return
    }
    yield results.records as SalesforceRecord[]

    let hasMore = hadMore(results)
    while (hasMore) {
      const nextRecordsUrl = results.nextRecordsUrl as string
      // eslint-disable-next-line no-await-in-loop
      results = await this.queryMore(nextRecordsUrl, useToolingApi)
      if (results.records === undefined) {
        log.warn(
          "could not find records in queryAll response for queryMore('%s', %s), response: %o",
          queryString,
          useToolingApi,
          results,
        )
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
  public async queryAll(queryString: string, useToolingApi = false): Promise<AsyncIterable<SalesforceRecord[]>> {
    return this.getQueryAllIterable(queryString, useToolingApi)
  }

  @mapToUserFriendlyErrorMessages
  @throttle<ClientRateLimitConfig>({ bucketName: 'deploy' })
  @logDecorator()
  @requiresLogin()
  public async bulkLoadOperation(
    type: string,
    operation: BulkLoadOperation,
    records: SalesforceRecord[],
  ): Promise<BatchResultInfo[]> {
    log.trace(
      'client.bulkLoadOperation: %s %d records of type %s: %s',
      operation,
      records.length,
      type,
      inspectValue(records, { maxArrayLength: null }),
    )
    const batch = this.conn.bulk.load(
      type,
      operation,
      { extIdField: CUSTOM_OBJECT_ID_FIELD, concurrencyMode: 'Parallel' },
      records,
    )
    const { job } = batch
    await new Promise(resolve => job.on('close', resolve))
    const result = (await batch.then()) as BatchResultInfo[]
    log.trace('client.bulkLoadOperation result: %o', result)
    return flatValues(result)
  }

  @mapToUserFriendlyErrorMessages
  @logDecorator()
  @requiresLogin()
  public async request(url: string): Promise<unknown> {
    return this.conn.request(url)
  }

  @logDecorator()
  public async awaitCompletionOfAllListRequests(): Promise<void> {
    await Promise.all(Object.values(this.fullListPromisesByType))
  }
}
