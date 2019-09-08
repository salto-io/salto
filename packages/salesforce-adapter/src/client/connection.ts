import { Stream } from 'stream'
import {
  MetadataObject, ValueTypeField, MetadataInfo, SaveResult, ListMetadataQuery, FileProperties,
  DescribeSObjectResult, DescribeGlobalSObjectResult,
  DeployOptions, DeployResultLocator, DeployResult, QueryResult,
} from 'jsforce'

export interface Metadata {
  describe(): Promise<{ metadataObjects: MetadataObject[] }>
  describeValueType(type: string): Promise<{ valueTypeFields: ValueTypeField[] }>
  read(type: string, fullNames: string | string[]): Promise<MetadataInfo | MetadataInfo[]>
  list(queries: ListMetadataQuery | ListMetadataQuery[]): Promise<FileProperties[]>
  create(
    type: string, metadata: MetadataInfo | MetadataInfo[]
  ): Promise<SaveResult | SaveResult[]>
  delete(type: string, fullNames: string | string[]): Promise<SaveResult | SaveResult[]>
  update(
    type: string, updateMetadata: MetadataInfo | MetadataInfo[]
  ): Promise<SaveResult | SaveResult[]>
  deploy(
    zipInput: Stream | Buffer | string, options: DeployOptions
  ): DeployResultLocator<DeployResult>
}

export interface Soap {
  describeSObjects(
    typeNames: string | string[]
  ): Promise<DescribeSObjectResult | DescribeSObjectResult[]>
}

export interface Global {
  sobjects: DescribeGlobalSObjectResult[]
}

export default interface Connection {
  login(user: string, password: string): Promise<unknown>
  metadata: Metadata
  soap: Soap
  describeGlobal(): Promise<Global>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query(soql: string): Promise<QueryResult<any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryMore(locator: string): Promise<QueryResult<any>>
}
