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
  BulkLoadOperation,
} from 'jsforce'
import { Value } from 'adapter-api'
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

function login(client: SalesforceClient, _name: string, descriptor: PropertyDescriptor):
  PropertyDescriptor {
  const original = descriptor.value

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor.value = async function withLogin(...args: any[]) {
    await client.login.apply(this)
    return original.apply(this, args)
  }

  return descriptor
}

function logFailures(_client: SalesforceClient, name: string, descriptor: PropertyDescriptor):
  PropertyDescriptor {
  const original = descriptor.value

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor.value = function withLog(...args: any[]) {
    return Promise.resolve(original.apply(this, args)).catch(e => {
      // TODO: should be replaced with real log
      // eslint-disable-next-line no-console
      console.error(`Failed to run SFDC client call: ${name}(${args
        .map(a => JSON.stringify(a)).filter(a => a).join()}): ${JSON.stringify(e)}`)
      throw e
    })
  }
  return descriptor
}

function validateSaveResult(_client: SalesforceClient, _name: string,
  descriptor: PropertyDescriptor): PropertyDescriptor {
  const original = descriptor.value

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor.value = function withValidation(...args: any[]) {
    return Promise.resolve(original.apply(this, args)).then(result => {
      const errors = makeArray(result)
        .filter(r => r)
        .map(r => r as CompleteSaveResult)
        .filter(r => r.errors)
      if (errors.length > 0) {
        const strErrors = errors.map(r => makeArray(r.errors).map(e => e.message).join('\n'))
        throw new Error(strErrors.join('\n'))
      }
      return result
    })
  }
  return descriptor
}

function validateDeployResult(_client: SalesforceClient, _name: string,
  descriptor: PropertyDescriptor): PropertyDescriptor {
  const original = descriptor.value

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptor.value = function withValidation(...args: any[]) {
    return Promise.resolve(original.apply(this, args)).then(res => {
      const result = res as DeployResult
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
    })
  }
  return descriptor
}

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

export default class SalesforceClient {
  private readonly conn: Connection
  private isLoggedIn = false
  private readonly credentials: Credentials

  constructor(
    { credentials, connection }: SalesforceClientOpts
  ) {
    this.credentials = credentials
    this.conn = connection || realConnection(credentials.isSandbox)
  }

  public async login(): Promise<void> {
    if (!this.isLoggedIn) {
      const { username, password, apiToken } = this.credentials
      await this.conn.login(username, password + (apiToken || ''))
      this.isLoggedIn = true
    }
  }

  @logFailures
  @login
  public async runQuery(queryString: string): Promise<QueryResult<Value>> {
    return this.conn.query(queryString)
  }

  @logFailures
  @login
  public async queryMore(locator: string): Promise<QueryResult<Value>> {
    return this.conn.queryMore(locator)
  }

  @logFailures
  @login
  public async destroy(
    type: string, ids: string | string[]
  ): Promise<(RecordResult | RecordResult[])> {
    return this.conn.destroy(type, ids)
  }

  /**
   * Extract metadata object names
   */
  @logFailures
  @login
  public async listMetadataTypes(): Promise<MetadataObject[]> {
    const describeResult = this.conn.metadata.describe()
    return (await describeResult).metadataObjects
  }

  /**
   * Read information about a value type
   * @param type The name of the metadata type for which you want metadata
   */
  @logFailures
  @login
  public async describeMetadataType(type: string): Promise<ValueTypeField[]> {
    const fullName = `{${METADATA_NAMESPACE}}${type}`
    const describeResult = this.conn.metadata.describeValueType(fullName)
    return (await describeResult).valueTypeFields
  }

  @logFailures
  @login
  public async listMetadataObjects(type: string): Promise<FileProperties[]> {
    return makeArray(await this.conn.metadata.list({ type }))
  }

  /**
   * Read metadata for salesforce object of specific type and name
   */
  @logFailures
  @login
  public async readMetadata(type: string, name: string | string[]): Promise<MetadataInfo[]> {
    return sendChunked(makeArray(name), chunk =>
      this.conn.metadata.read(type, chunk), MAX_ITEMS_IN_READ_METADATA_REQUEST)
  }

  /**
   * Extract sobject names
   */
  @logFailures
  @login
  public async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    return (await this.conn.describeGlobal()).sobjects
  }

  @logFailures
  @login
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
  @logFailures
  @validateSaveResult
  @login
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
  @logFailures
  @validateSaveResult
  @login
  public async delete(type: string, fullNames: string | string[]): Promise<SaveResult[]> {
    return sendChunked(fullNames, chunk => this.conn.metadata.delete(type, chunk))
  }

  /**
   * Updates salesforce client
   * @param type The metadata type of the components to be updated
   * @param metadata The metadata of the object
   * @returns The save result of the requested update
   */
  @logFailures
  @validateSaveResult
  @login
  public async update(type: string, metadata: MetadataInfo | MetadataInfo[]):
    Promise<SaveResult[]> {
    return sendChunked(metadata, chunk => this.conn.metadata.update(type, chunk))
  }

  /**
   * Updates salesforce metadata with the Deploy API
   * @param zip The package zip
   * @returns The save result of the requested update
   */
  @logFailures
  @validateDeployResult
  @login
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
  @logFailures
  @login
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
