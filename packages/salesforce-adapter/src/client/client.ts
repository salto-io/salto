import { inspect, isObject } from 'util'
import _ from 'lodash'
import { collections, decorators } from '@salto/lowerdash'
import {
  Connection as RealConnection,
  MetadataObject,
  DescribeGlobalSObjectResult,
  FileProperties,
  MetadataInfo,
  SaveResult,
  ValueTypeField,
  DescribeSObjectResult,
  QueryResult,
  DeployResult,
  BatchResultInfo,
  Record as SfRecord,
  RecordResult,
  BulkLoadOperation,
} from 'jsforce'
import { Value, Metrics } from 'adapter-api'
import { CompleteSaveResult } from './types'
import Connection from './jsforce'

const { makeArray } = collections.array

export const API_VERSION = '46.0'
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

const validateSaveResult = decorators.wrapMethodWith(
  async (original: decorators.OriginalCall): Promise<unknown> => {
    const result = await original.call()

    const errors = makeArray(result)
      .filter(r => r)
      .map(r => r as CompleteSaveResult)
      .filter(r => r.errors)

    if (errors.length > 0) {
      const strErrors = errors.map(r => makeArray(r.errors).map(e => e.message).join('\n'))
      throw new Error(strErrors.join('\n'))
    }

    return result
  }
)

const validateDeployResult = decorators.wrapMethodWith(
  async (original: decorators.OriginalCall): Promise<unknown> => {
    const result = await original.call() as DeployResult
    if (result.success) {
      return result
    }

    const errors = _(result.details)
      .map(detail => detail.componentFailures || [])
      .flatten()
      .filter(component => !component.success)
      .map(failure => `${failure.componentType}.${failure.fullName}: ${failure.problem}`)
      .value()

    throw new Error(errors.join('\n'))
  }
)

export type Credentials = {
  username: string
  password: string
  apiToken?: string
  isSandbox: boolean
}

export type LogLevel = 'info' | 'warn' | 'error'

export type Logger = {
  [level in LogLevel]: (message: string) => void
}

export type SalesforceClientOpts = {
  credentials: Credentials
  connection?: Connection
  logger?: Logger
  metrics?: Metrics
}

const realConnection = (isSandbox: boolean): Connection => {
  const connection = new RealConnection({
    version: API_VERSION,
    loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`,
  })

  // Set poll interval and timeout for deploy
  connection.metadata.pollInterval = 3000
  connection.metadata.pollTimeout = 60000

  return connection
}

const sendChunked = async <TIn, TOut>(input: TIn | TIn[],
  sendChunk: (chunk: TIn[]) => Promise<TOut | TOut[]>,
  chunkSize = MAX_ITEMS_IN_WRITE_REQUEST):
  Promise<TOut[]> => {
  const chunks = _.chunk(makeArray(input), chunkSize)
  const promises: Promise<TOut[]>[] = chunks.map(chunk => sendChunk(chunk).then(makeArray))
  const results = await Promise.all(promises)
  return _.flatten(results)
}

// eslint-disable-next-line @typescript-eslint/ban-types
const withMetricsReport = <T extends Object>(origin: T, metrics: Metrics,
  prefix = 'API.SFDC'): T =>
    new Proxy(origin, {
      get(obj: T, key: string | number | symbol) {
        const prop = _.get(obj, key)
        const metric = `${prefix}.${key.toString()}`
        if (isObject(prop)) {
          return withMetricsReport(prop, metrics, metric)
        }
        metrics.report(metric, 1)
        return prop
      },
    })

export default class SalesforceClient {
  private readonly conn: Connection
  private isLoggedIn = false
  private readonly credentials: Credentials
  private readonly logger: Logger

  constructor(
    {
      credentials, connection, logger, metrics,
    }: SalesforceClientOpts
  ) {
    this.credentials = credentials
    const conn = connection || realConnection(credentials.isSandbox)
    this.conn = metrics ? withMetricsReport(conn, metrics) : conn

    this.logger = logger || console
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      const { username, password, apiToken } = this.credentials
      await this.conn.login(username, password + (apiToken || ''))
      this.isLoggedIn = true
    }
  }

  protected static requiresLogin = decorators.wrapMethodWith(
    async function withLogin(
      this: SalesforceClient,
      { call }: decorators.OriginalCall
    ): Promise<unknown> {
      await this.ensureLoggedIn()
      return call()
    }
  )

  private static logFailures = decorators.wrapMethodWith(
    async function logFailure(
      this: SalesforceClient,
      { call, name, args }: decorators.OriginalCall,
    ): Promise<unknown> {
      try {
        return await call()
      } catch (e) {
        const message = [
          'Failed to run SFDC client call',
          `${name}(${args.map(arg => inspect(arg)).join(', ')}):`,
          e.message,
        ].join(' ')

        this.logger.error(message)
        throw e
      }
    }
  )

  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async runQuery(queryString: string): Promise<QueryResult<Value>> {
    return this.conn.query(queryString)
  }

  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async queryMore(locator: string): Promise<QueryResult<Value>> {
    return this.conn.queryMore(locator)
  }

  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async destroy(
    type: string, ids: string | string[]
  ): Promise<(RecordResult | RecordResult[])> {
    return this.conn.destroy(type, ids)
  }

  /**
   * Extract metadata object names
   */
  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async listMetadataTypes(): Promise<MetadataObject[]> {
    const describeResult = this.conn.metadata.describe()
    return (await describeResult).metadataObjects
  }

  /**
   * Read information about a value type
   * @param type The name of the metadata type for which you want metadata
   */
  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async describeMetadataType(type: string): Promise<ValueTypeField[]> {
    const fullName = `{${METADATA_NAMESPACE}}${type}`
    const describeResult = this.conn.metadata.describeValueType(fullName)
    return (await describeResult).valueTypeFields
  }

  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async listMetadataObjects(type: string): Promise<FileProperties[]> {
    return makeArray(await this.conn.metadata.list({ type }))
  }

  /**
   * Read metadata for salesforce object of specific type and name
   */
  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async readMetadata(type: string, name: string | string[]): Promise<MetadataInfo[]> {
    return sendChunked(makeArray(name), chunk =>
      this.conn.metadata.read(type, chunk), MAX_ITEMS_IN_READ_METADATA_REQUEST)
  }

  /**
   * Extract sobject names
   */
  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    return (await this.conn.describeGlobal()).sobjects
  }

  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async describeSObjects(objectNames: string[]):
    Promise<DescribeSObjectResult[]> {
    return sendChunked(objectNames, chunk => this.conn.soap.describeSObjects(chunk),
      MAX_ITEMS_IN_DESCRIBE_REQUEST)
  }

  /**
   * Creates a salesforce object
   * @param type The metadata type of the components to be created
   * @param metadata The metadata of the object
   * @returns The save result of the requested creation
   */
  @SalesforceClient.logFailures
  @validateSaveResult
  @SalesforceClient.requiresLogin
  public async create(type: string, metadata: MetadataInfo | MetadataInfo[]):
    Promise<SaveResult[]> {
    return sendChunked(metadata, chunk => this.conn.metadata.create(type, chunk))
  }

  /**
   * Deletes salesforce client
   * @param type The metadata type of the components to be deleted
   * @param fullNames The full names of the metadata components
   * @returns The save result of the requested deletion
   */
  @SalesforceClient.logFailures
  @validateSaveResult
  @SalesforceClient.requiresLogin
  public async delete(type: string, fullNames: string | string[]): Promise<SaveResult[]> {
    return sendChunked(fullNames, chunk => this.conn.metadata.delete(type, chunk))
  }

  /**
   * Updates salesforce client
   * @param type The metadata type of the components to be updated
   * @param metadata The metadata of the object
   * @returns The save result of the requested update
   */
  @SalesforceClient.logFailures
  @validateSaveResult
  @SalesforceClient.requiresLogin
  public async update(type: string, metadata: MetadataInfo | MetadataInfo[]):
    Promise<SaveResult[]> {
    return sendChunked(metadata, chunk => this.conn.metadata.update(type, chunk))
  }

  /**
   * Updates salesforce metadata with the Deploy API
   * @param zip The package zip
   * @returns The save result of the requested update
   */
  @SalesforceClient.logFailures
  @validateDeployResult
  @SalesforceClient.requiresLogin
  public async deploy(zip: Buffer): Promise<DeployResult> {
    return this.conn.metadata.deploy(zip, { rollbackOnError: true }).complete(true)
  }

  /**
   * Loads a stream of CSV data to the bulk API
   * @param type The type of the objects to update
   * @param operation The type of operation to perform, such as upsert, delete, etc.
   * @param records The records from the CSV contents
   * @returns The BatchResultInfo which contains success/errors for each entry
   */
  @SalesforceClient.logFailures
  @SalesforceClient.requiresLogin
  public async updateBulk(type: string, operation: BulkLoadOperation, records: SfRecord[]):
    Promise<BatchResultInfo[]> {
    // Initiate the batch job
    const batch = this.conn.bulk.load(type, operation, { extIdField: 'Id', concurrencyMode: 'Parallel' }, records)
    // We need to wait for the job to execute (this what the next line does),
    // otherwise the retrieve() will fail
    // So the following line is a part of SFDC Bulk API, not promise API.
    await batch.then()
    return batch.retrieve() as Promise<BatchResultInfo[]>
  }
}
