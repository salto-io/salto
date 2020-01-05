import { Stream } from 'stream'
import {
  MetadataObject, ValueTypeField, MetadataInfo, SaveResult, UpsertResult,
  ListMetadataQuery, FileProperties, DescribeSObjectResult,
  DescribeGlobalSObjectResult, DeployOptions, DeployResultLocator,
  DeployResult, QueryResult, BulkLoadOperation, BulkOptions, Batch,
  Record as SfRecord,
  RecordResult, RetrieveRequest, RetrieveResult, Callback, RetrieveResultLocator,
} from 'jsforce'
import { Value } from 'adapter-api'

// This class is the interfaces we use from jsforce library
// It's here so we will be able to mock jsforce efficiently

export interface Metadata {
  describe(): Promise<{ metadataObjects: MetadataObject[] }>
  describeValueType(type: string): Promise<{ valueTypeFields: ValueTypeField[] }>
  read(type: string, fullNames: string | string[]): Promise<MetadataInfo | MetadataInfo[]>
  list(queries: ListMetadataQuery | ListMetadataQuery[]): Promise<FileProperties[]>
  create(
    type: string, metadata: MetadataInfo | MetadataInfo[]
  ): Promise<SaveResult | SaveResult[]>
  upsert(
    type: string, metadata: MetadataInfo | MetadataInfo[]
  ): Promise<UpsertResult | UpsertResult[]>
  delete(type: string, fullNames: string | string[]): Promise<SaveResult | SaveResult[]>
  update(
    type: string, updateMetadata: MetadataInfo | MetadataInfo[]
  ): Promise<SaveResult | SaveResult[]>
  retrieve(request: RetrieveRequest,
    callback?: Callback<RetrieveResult>): RetrieveResultLocator<RetrieveResult>
  deploy(
    zipInput: Stream | Buffer | string, options: DeployOptions
  ): DeployResultLocator<DeployResult>
}

export interface Soap {
  describeSObjects(
    typeNames: string | string[]
  ): Promise<DescribeSObjectResult | DescribeSObjectResult[]>
}

export interface Bulk {
  load(type: string, operation: BulkLoadOperation, options?: BulkOptions, input?: SfRecord[]): Batch
}

export interface Global {
  sobjects: DescribeGlobalSObjectResult[]
}

export default interface Connection {
  login(user: string, password: string): Promise<unknown>
  metadata: Metadata
  soap: Soap
  bulk: Bulk
  describeGlobal(): Promise<Global>
  query(soql: string): Promise<QueryResult<Value>>
  queryMore(locator: string): Promise<QueryResult<Value>>
  destroy(type: string, ids: string | string[]): Promise<(RecordResult | RecordResult[])>
}
