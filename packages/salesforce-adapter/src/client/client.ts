import {
  Connection,
  Field,
  MetadataObject,
  DescribeGlobalSObjectResult,
  FileProperties,
  MetadataInfo,
  SaveResult,
  ValueTypeField,
} from 'jsforce'

const apiVersion = '45.0'

export default class SalesforceClient {
  private conn: Connection
  private isLoggedIn: boolean = false

  constructor(
    private username: string,
    private password: string,
    isSandbox: boolean
  ) {
    this.conn = new Connection({
      version: apiVersion,
      loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`,
    })
  }

  // In the future this can be replaced with decorators - currently experimental feature
  private async login(): Promise<void> {
    if (!this.isLoggedIn) {
      await this.conn.login(this.username, this.password)
      this.isLoggedIn = true
    }
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
  public async discoverMetadataObject(
    objectName: string
  ): Promise<ValueTypeField[]> {
    await this.login()
    const result = await this.conn.metadata.describeValueType(
      `{http://soap.sforce.com/2006/04/metadata}${objectName}`
    )
    return result.valueTypeFields
  }

  public async listMetadataObjects(type: string): Promise<FileProperties[]> {
    await this.login()
    return this.conn.metadata.list({ type })
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

  public async discoverSObject(objectName: string): Promise<Field[]> {
    await this.login()
    return (await this.conn.describe(objectName)).fields
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
  ): Promise<SaveResult | SaveResult[]> {
    await this.login()
    return this.conn.metadata.create(type, metadata)
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
  ): Promise<SaveResult | SaveResult[]> {
    await this.login()
    return this.conn.metadata.delete(metadataType, fullNames)
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
  ): Promise<SaveResult | SaveResult[]> {
    await this.login()
    return this.conn.metadata.update(metadataType, metadata)
  }
}
