import _ from 'lodash'
import { collections } from '@salto/lowerdash'
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
} from 'jsforce'
import { Value } from 'adapter-api'
import {
  CompleteSaveResult, SfError,
} from './types'
import Connection from './connection'

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

export type Credentials = {
  username: string
  password: string
  apiToken?: string
  isSandbox: boolean
}

export type SalesforceClientOpts = {
  credentials: Credentials
  connection?: Connection
}

// TODO: should be replaced with real log
const log = (message: string): void => {
  // eslint-disable-next-line no-console
  console.error(message)
}

export default class SalesforceClient {
  private readonly conn: Connection
  private isLoggedIn = false
  private readonly credentials: Credentials

  constructor(
    { credentials, connection }: SalesforceClientOpts
  ) {
    this.credentials = credentials
    this.conn = connection || SalesforceClient.realConnection(credentials.isSandbox)
  }

  private static realConnection(isSandbox: boolean): Connection {
    const connection = new RealConnection({
      version: API_VERSION,
      loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`,
    })
    // Set poll interval and timeout for deploy
    connection.metadata.pollInterval = 3000
    connection.metadata.pollTimeout = 60000

    return connection
  }

  // In the future this can be replaced with decorators - currently experimental feature
  private async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      const { username, password, apiToken } = this.credentials
      await this.conn.login(username, password + (apiToken || ''))
      this.isLoggedIn = true
    }
  }

  private static async sendChunked<TIn, TOut>(
    input: TIn | TIn[],
    sendChunk: (chunk: TIn[]) => Promise<TOut | TOut[]>,
    chunkSize = MAX_ITEMS_IN_WRITE_REQUEST,
  ): Promise<TOut[]> {
    const chunks = _.chunk(makeArray(input), chunkSize)
    const promises: Promise<TOut[]>[] = chunks.map(chunk => sendChunk(chunk).then(makeArray))
    const results = await Promise.all(promises)
    return _.flatten(results)
  }

  private static validateSaveResult(result: SaveResult[]): SaveResult[] {
    const errorMessage = (error: SfError | SfError[]): string =>
      makeArray(error).map(e => e.message).join('\n')

    const errors = makeArray(result)
      .filter(r => r)
      .map(r => r as CompleteSaveResult)
      .filter(r => r.errors)

    if (errors.length > 0) {
      throw new Error(errors.map(r => errorMessage(r.errors)).join('\n'))
    }

    return result
  }

  private static validateDeployResult(result: DeployResult): DeployResult {
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

  public async runQuery(queryString: string): Promise<QueryResult<Value>> {
    await this.ensureLoggedIn()
    return this.conn.query(queryString)
      .catch(e => {
        log(`failed to query ${queryString}`)
        throw e
      })
  }

  public async queryMore(locator: string): Promise<QueryResult<Value>> {
    await this.ensureLoggedIn()
    return this.conn.queryMore(locator)
      .catch(e => {
        log(`failed to queryMore ${locator}`)
        throw e
      })
  }

  public async destroy(
    type: string, ids: string | string[]
  ): Promise<(RecordResult | RecordResult[])> {
    await this.ensureLoggedIn()
    return this.conn.destroy(type, ids)
      .catch(e => {
        log(`failed to destroy type ${type} with ids ${JSON.stringify(ids)}`)
        throw e
      })
  }

  /**
   * Extract metadata object names
   */
  public async listMetadataTypes(): Promise<MetadataObject[]> {
    await this.ensureLoggedIn()
    const describeResult = await this.conn.metadata.describe()
      .catch(e => {
        log('Failed to list metadata types')
        throw e
      })
    return describeResult.metadataObjects
  }

  /**
   * Read information about a value type
   * @param type The name of the metadata type for which you want metadata
   */
  public async describeMetadataType(type: string): Promise<ValueTypeField[]> {
    await this.ensureLoggedIn()
    const fullName = `{${METADATA_NAMESPACE}}${type}`
    const describeResult = await this.conn.metadata.describeValueType(fullName)
      .catch(e => {
        log(`Failed to describe metadata type ${type}`)
        throw e
      })
    return describeResult.valueTypeFields
  }

  public async listMetadataObjects(type: string): Promise<FileProperties[]> {
    await this.ensureLoggedIn()
    return makeArray(await this.conn.metadata.list({ type })
      .catch(e => {
        log(`failed to list metadata objects for type ${type}`)
        throw e
      }))
  }

  /**
   * Read metadata for salesforce object of specific type and name
   */
  public async readMetadata(
    type: string, name: string | string[]
  ): Promise<MetadataInfo[]> {
    await this.ensureLoggedIn()
    return SalesforceClient.sendChunked(makeArray(name), chunk =>
      this.conn.metadata.read(type, chunk)
        .catch(e => {
          log(`failed to read metadata for type ${type} with names ${chunk}`)
          throw e
        }),
    MAX_ITEMS_IN_READ_METADATA_REQUEST)
  }

  /**
   * Extract sobject names
   */
  public async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    await this.ensureLoggedIn()
    const listResult = await this.conn.describeGlobal()
      .catch(e => {
        log('failed to list sobjects')
        throw e
      })
    return listResult.sobjects
  }

  public async describeSObjects(objectNames: string[]):
    Promise<DescribeSObjectResult[]> {
    await this.ensureLoggedIn()
    return SalesforceClient.sendChunked(objectNames, chunk =>
      this.conn.soap.describeSObjects(chunk)
        .catch(e => {
          log(`failed to describe sobjects ${JSON.stringify(chunk)}`)
          throw e
        }),
    MAX_ITEMS_IN_DESCRIBE_REQUEST)
  }

  /**
   * Creates a salesforce object
   * @param type The metadata type of the components to be created
   * @param metadata The metadata of the object
   * @returns The save result of the requested creation
   */
  // TODO: Extend the create API to create SObjects as well, not only metadata
  public async create(type: string, metadata: MetadataInfo | MetadataInfo[]):
    Promise<SaveResult[]> {
    await this.ensureLoggedIn()
    return SalesforceClient.validateSaveResult(
      await SalesforceClient.sendChunked(metadata, chunk =>
        this.conn.metadata.create(type, chunk)
          .catch(e => {
            log(`failed to create metadata for type ${type} and metadata ${JSON.stringify(chunk)}`)
            throw e
          }))
    )
  }

  /**
   * Deletes salesforce client
   * @param type The metadata type of the components to be deleted
   * @param fullNames The full names of the metadata components
   * @returns The save result of the requested deletion
   */
  // TODO: Extend the delete API to remove SObjects as well, not only metadata components
  public async delete(type: string, fullNames: string | string[]): Promise<SaveResult[]> {
    await this.ensureLoggedIn()
    return SalesforceClient.validateSaveResult(
      await SalesforceClient.sendChunked(fullNames, chunk =>
        this.conn.metadata.delete(type, chunk)
          .catch(e => {
            log(`failed to delete metadata for type ${type} and full names ${fullNames}`)
            throw e
          }))
    )
  }

  /**
   * Updates salesforce client
   * @param type The metadata type of the components to be updated
   * @param metadata The metadata of the object
   * @returns The save result of the requested update
   */
  public async update(type: string, metadata: MetadataInfo | MetadataInfo[]):
    Promise<SaveResult[]> {
    await this.ensureLoggedIn()
    return SalesforceClient.validateSaveResult(await SalesforceClient.sendChunked(metadata,
      chunk => this.conn.metadata.update(type, chunk)
        .catch(e => {
          log(`failed to update metadata for type ${type} and matadata ${JSON.stringify(metadata)}`)
          throw e
        })))
  }

  /**
   * Updates salesforce metadata with the Deploy API
   * @param zip The package zip
   * @returns The save result of the requested update
   */
  public async deploy(zip: Buffer): Promise<DeployResult> {
    await this.ensureLoggedIn()
    return SalesforceClient.validateDeployResult(
      await this.conn.metadata.deploy(zip, { rollbackOnError: true }).complete(true)
        .catch(e => {
          log('failed to deploy')
          throw e
        })
    )
  }

  /**
   * Loads a stream of CSV data to the bulk API
   * @param type The type of the objects to upsert
   * @param records The stream with the CSV contents
   * @returns The BatchResultInfo which contains success/errors for each entry
   */
  public async uploadBulk(type: string, records: SfRecord[]): Promise<BatchResultInfo[]> {
    await this.ensureLoggedIn()

    // Initiate the batch job
    const batch = this.conn.bulk.load(type, 'upsert', { extIdField: 'Id', concurrencyMode: 'Parallel' }, records)
    // We need to wait for the job to execute (this what the next line does),
    // otherwise the retrieve() will fail
    // So the following line is a part of SFDC Bulk API, not promise API.
    await batch.then().catch(e => {
      log(`failed to load batch of #${records.length} records of type ${type}`)
      throw e
    })
    return await batch.retrieve().catch(e => {
      log(`failed to retrive batch of #${records.length} records of type ${type}`)
      throw e
    }) as BatchResultInfo[]
  }
}
