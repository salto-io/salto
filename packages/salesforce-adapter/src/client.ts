import {
  Connection,
  Field,
  MetadataObject,
  DescribeGlobalSObjectResult
} from 'jsforce'

const apiVersion = '45.0'

export default class SalesforceClient {
  private conn: Connection
  private isLoggedIn: boolean

  constructor(
    private username: string,
    private password: string,
    isSnadbox: boolean
  ) {
    this.conn = new Connection({
      version: apiVersion,
      loginUrl: `https://${isSnadbox ? 'test' : 'login'}.salesforce.com/`
    })
  }

  // In the future this can be replaced with decorators - currently experimental feature
  private async login(): Promise<void> {
    if (!this.isLoggedIn) {
      await this.conn.login(this.username, this.password)
      this.isLoggedIn = true
    }
  }

  // Extract metadata object names
  async listMetadataObjects(): Promise<MetadataObject[]> {
    await this.login()
    const result = await this.conn.metadata.describe()
    return result.metadataObjects
  }

  // Extract sobject names
  async listSObjects(): Promise<DescribeGlobalSObjectResult[]> {
    await this.login()
    const result = await this.conn.describeGlobal()
    return result.sobjects
  }

  async discoverSObject(objectName: string): Promise<Field[]> {
    await this.login()
    return (await this.conn.describe(objectName)).fields
  }
}
