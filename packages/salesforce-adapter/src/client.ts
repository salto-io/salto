import {
  Connection,
  Field,
  MetadataObject,
  DescribeGlobalSObjectResult,
  FileProperties,
  MetadataInfo,
  SaveResult
} from 'jsforce'

const apiVersion = '45.0'

export default class SalesforceClient {
  private conn: Connection
  private isLoggedIn: boolean

  constructor(
    private username: string,
    private password: string,
    isSandbox: boolean
  ) {
    this.conn = new Connection({
      version: apiVersion,
      loginUrl: `https://${isSandbox ? 'test' : 'login'}.salesforce.com/`
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
  async listMetadataTypes(): Promise<MetadataObject[]> {
    await this.login()
    const result = await this.conn.metadata.describe()
    return result.metadataObjects
  }

  async listMetadataObjects(type: string): Promise<FileProperties[]> {
    await this.login()
    return this.conn.metadata.list({ type })
  }

  /**
   * Read metadata for salesforce object of specific type and name
   */
  async readMetadata(type: string, name: string): Promise<MetadataInfo> {
    return (await this.conn.metadata.read(type, name)) as MetadataInfo
  }

  /**
   * Extract sobject names
   */
  async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    await this.login()
    return (await this.conn.describeGlobal()).sobjects
  }

  async discoverSObject(objectName: string): Promise<Field[]> {
    await this.login()
    return (await this.conn.describe(objectName)).fields
  }

  async create(
    type: string,
    metadata: MetadataInfo | MetadataInfo[]
  ): Promise<SaveResult | SaveResult[]> {
    await this.login()
    return this.conn.metadata.create(type, metadata)
  }
}
