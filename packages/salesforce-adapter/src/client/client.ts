import _ from 'lodash'
import {
  Connection,
  MetadataObject,
  DescribeGlobalSObjectResult,
  FileProperties,
  MetadataInfo,
  SaveResult,
  ValueTypeField,
  DescribeSObjectResult,
  DeployResult,
} from 'jsforce'
import makeArray from './make_array'

export const API_VERSION = '46.0'
export const METADATA_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

// Salesforce limitation of maximum number of items per create/update/delete calls
const MAX_ITEMS_IN_REQUEST = 10

// Make sure results are lists with no undefined values in them
const ensureListResult = <T>(result: T|T[]): T[] =>
  makeArray(result).filter(item => item !== undefined)

export default class SalesforceClient {
  private conn: Connection
  private isLoggedIn = false

  constructor(
    private username: string,
    private password: string,
    isSandbox: boolean
  ) {
    this.conn = new Connection({
      version: API_VERSION,
      loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`,
    })
    // Set poll interval and timeout for deploy
    this.conn.metadata.pollTimeout = 3000
    this.conn.metadata.pollTimeout = 30000
  }

  // In the future this can be replaced with decorators - currently experimental feature
  private async login(): Promise<void> {
    if (!this.isLoggedIn) {
      await this.conn.login(this.username, this.password)
      this.isLoggedIn = true
    }
  }

  private static async sendChunked<TIn>(
    input: TIn | TIn[],
    sendRequest: (chunk: TIn[]) => Promise<SaveResult[] | SaveResult>,
  ): Promise<SaveResult[]> {
    const chunks = _.chunk(makeArray(input), MAX_ITEMS_IN_REQUEST)
    const results = await Promise.all(chunks.map(sendRequest))
    return _.flatten(results.map(makeArray))
  }

  /**
   * Extract metadata object names
   */
  public async listMetadataTypes(): Promise<MetadataObject[]> {
    await this.login()
    const result = await this.conn.metadata.describe()
    return result.metadataObjects
  }

  /**
   * Read information about a value type
   * @param objectName The name of the metadata type for which you want metadata
   */
  public async describeMetadataType(
    objectName: string
  ): Promise<ValueTypeField[]> {
    await this.login()
    const result = await this.conn.metadata.describeValueType(
      `{${METADATA_NAMESPACE}}${objectName}`
    )
    return result.valueTypeFields
  }

  public async listMetadataObjects(type: string): Promise<FileProperties[]> {
    await this.login()
    return ensureListResult(await this.conn.metadata.list({ type }))
  }

  /**
   * Read metadata for salesforce object of specific type and name
   */
  public async readMetadata(type: string, name: string | string[]):
  Promise<MetadataInfo | MetadataInfo[]> {
    await this.login()
    return this.conn.metadata.read(type, name)
  }

  /**
   * Extract sobject names
   */
  public async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    await this.login()
    return (await this.conn.describeGlobal()).sobjects
  }

  public async describeSObjects(objectNames: string[]):
    Promise<DescribeSObjectResult[]> {
    await this.login()
    return ensureListResult(await this.conn.soap.describeSObjects(objectNames))
  }

  /**
   * Creates a salesforce object
   * @param type The metadata type of the components to be created
   * @param metadata The metadata of the object
   * @returns The save result of the requested creation
   */
  // TODO: Extend the create API to create SObjects as well, not only metadata
  public async create(
    type: string,
    metadata: MetadataInfo | MetadataInfo[]
  ): Promise<SaveResult[]> {
    await this.login()
    return SalesforceClient.sendChunked(
      metadata,
      chunk => this.conn.metadata.create(type, chunk),
    )
  }

  /**
   * Deletes salesforce client
   * @param metadataType The metadata type of the components to be deleted
   * @param fullNames The full names of the metadata components
   * @returns The save result of the requested deletion
   */
  // TODO: Extend the delete API to remove SObjects as well, not only metadata components
  public async delete(
    metadataType: string,
    fullNames: string | string[]
  ): Promise<SaveResult[]> {
    await this.login()
    return SalesforceClient.sendChunked(
      fullNames,
      chunk => this.conn.metadata.delete(metadataType, chunk),
    )
  }

  /**
   * Updates salesforce client
   * @param metadataType The metadata type of the components to be updated
   * @param metadata The metadata of the object
   * @returns The save result of the requested update
   */
  public async update(
    metadataType: string,
    metadata: MetadataInfo | MetadataInfo[]
  ): Promise<SaveResult[]> {
    await this.login()
    return SalesforceClient.sendChunked(
      metadata,
      chunk => this.conn.metadata.update(metadataType, chunk),
    )
  }

  /**
   * Updates salesforce metadata with the Deploy API
   * @param zip The package zip
   * @returns The save result of the requested update
   */
  public async deploy(zip: Buffer): Promise<DeployResult> {
    await this.login()
    return this.conn.metadata.deploy(zip, { rollbackOnError: true }).complete(true)
  }
}
