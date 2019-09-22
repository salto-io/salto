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

const ensureSuccessfulRun = <T>(promise: Promise<T>, errorMessage: string): Promise<T> =>
  promise.catch(e => {
    // TODO: should be replaced with real log
    // eslint-disable-next-line no-console
    console.error(errorMessage)
    throw e
  })

const sendChunked = async <TIn, TOut> (input: TIn | TIn[],
  sendChunk: (chunk: TIn[]) => Promise<TOut | TOut[]>,
  chunkSize = MAX_ITEMS_IN_WRITE_REQUEST):
  Promise<TOut[]> => {
  const chunks = _.chunk(makeArray(input), chunkSize)
  const promises: Promise<TOut[]>[] = chunks.map(chunk => sendChunk(chunk).then(makeArray))
  const results = await Promise.all(promises)
  return _.flatten(results)
}

const validateSaveResult = (result: SaveResult[]): SaveResult[] => {
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

const validateDeployResult = (result: DeployResult): DeployResult => {
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

  public async runQuery(queryString: string): Promise<QueryResult<Value>> {
    await this.ensureLoggedIn()
    const queryResult = this.conn.query(queryString)
    return ensureSuccessfulRun(queryResult, `failed to query ${queryString}`)
  }

  public async queryMore(locator: string): Promise<QueryResult<Value>> {
    await this.ensureLoggedIn()
    const queryResult = this.conn.queryMore(locator)
    return ensureSuccessfulRun(queryResult, `failed to queryMore ${locator}`)
  }

  public async destroy(
    type: string, ids: string | string[]
  ): Promise<(RecordResult | RecordResult[])> {
    await this.ensureLoggedIn()
    const destroyResult = this.conn.destroy(type, ids)
    return ensureSuccessfulRun(destroyResult,
      `failed to destroy type ${type} with ids ${JSON.stringify(ids)}`)
  }

  /**
   * Extract metadata object names
   */
  public async listMetadataTypes(): Promise<MetadataObject[]> {
    await this.ensureLoggedIn()
    const describeResult = this.conn.metadata.describe()
    ensureSuccessfulRun(describeResult, 'Failed to list metadata types')
    return (await describeResult).metadataObjects
  }

  /**
   * Read information about a value type
   * @param type The name of the metadata type for which you want metadata
   */
  public async describeMetadataType(type: string): Promise<ValueTypeField[]> {
    await this.ensureLoggedIn()
    const fullName = `{${METADATA_NAMESPACE}}${type}`
    const describeResult = this.conn.metadata.describeValueType(fullName)
    ensureSuccessfulRun(describeResult, `Failed to describe metadata type ${type}`)
    return (await describeResult).valueTypeFields
  }

  public async listMetadataObjects(type: string): Promise<FileProperties[]> {
    await this.ensureLoggedIn()
    return makeArray(
      await ensureSuccessfulRun(this.conn.metadata.list({ type }),
        `failed to list metadata objects for type ${type}`)
    )
  }

  /**
   * Read metadata for salesforce object of specific type and name
   */
  public async readMetadata(type: string, name: string | string[]): Promise<MetadataInfo[]> {
    await this.ensureLoggedIn()
    return sendChunked(makeArray(name), chunk =>
      ensureSuccessfulRun(this.conn.metadata.read(type, chunk),
        `failed to read metadata for type ${type} with names ${chunk}`),
    MAX_ITEMS_IN_READ_METADATA_REQUEST)
  }

  /**
   * Extract sobject names
   */
  public async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    await this.ensureLoggedIn()
    const listResult = this.conn.describeGlobal()
    ensureSuccessfulRun(listResult, 'failed to list sobjects')
    return (await listResult).sobjects
  }

  public async describeSObjects(objectNames: string[]):
    Promise<DescribeSObjectResult[]> {
    await this.ensureLoggedIn()
    return sendChunked(objectNames, chunk =>
      ensureSuccessfulRun(this.conn.soap.describeSObjects(chunk),
        `failed to describe sobjects ${JSON.stringify(chunk)}`),
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
    return validateSaveResult(
      await sendChunked(metadata, chunk =>
        ensureSuccessfulRun(this.conn.metadata.create(type, chunk),
          `failed to create metadata for type ${type} and metadata ${JSON.stringify(chunk)}`))
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
    return validateSaveResult(
      await sendChunked(fullNames, chunk =>
        ensureSuccessfulRun(this.conn.metadata.delete(type, chunk),
          `failed to delete metadata for type ${type} and full names ${fullNames}`))
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
    return validateSaveResult(await sendChunked(metadata,
      chunk => ensureSuccessfulRun(this.conn.metadata.update(type, chunk),
        `failed to update metadata for type ${type} and matadata ${JSON.stringify(metadata)}`)))
  }

  /**
   * Updates salesforce metadata with the Deploy API
   * @param zip The package zip
   * @returns The save result of the requested update
   */
  public async deploy(zip: Buffer): Promise<DeployResult> {
    await this.ensureLoggedIn()
    const deployResult = this.conn.metadata.deploy(zip, { rollbackOnError: true }).complete(true)
    ensureSuccessfulRun(deployResult, 'failed to deploy')
    return validateDeployResult(await deployResult)
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
    await batch.then()
    const result = batch.retrieve() as Promise<BatchResultInfo[]>
    return ensureSuccessfulRun(result,
      `failed to retrive batch of #${records.length} records of type ${type}`)
  }
}
