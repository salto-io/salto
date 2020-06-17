/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { Stream } from 'stream'
import {
  MetadataObject, DescribeValueTypeResult, MetadataInfo, SaveResult, UpsertResult,
  ListMetadataQuery, FileProperties, DescribeSObjectResult, BulkOptions, BulkLoadOperation,
  DescribeGlobalSObjectResult, DeployOptions, DeployResultLocator, DeployResult,
  RetrieveRequest, RetrieveResult, Callback, RetrieveResultLocator, UserInfo, QueryResult, Batch,
  Record as SfRecord,
} from 'jsforce'
import { Value } from '@salto-io/adapter-api'

// This class is the interfaces we use from jsforce library
// It's here so we will be able to mock jsforce efficiently

export interface Metadata {
  describe(): Promise<{ metadataObjects: MetadataObject[] }>
  describeValueType(type: string): Promise<DescribeValueTypeResult>
  read(type: string, fullNames: string | string[]): Promise<MetadataInfo | MetadataInfo[]>
  list(queries: ListMetadataQuery | ListMetadataQuery[]): Promise<FileProperties[]>
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

export interface Global {
  sobjects: DescribeGlobalSObjectResult[]
}

export type Limit = {
  Remaining: number
}

export type Limits = {
  DailyApiRequests: Limit
}

export interface Bulk {
  load(type: string, operation: BulkLoadOperation, options?: BulkOptions, input?: SfRecord[]): Batch
}

export default interface Connection {
  login(user: string, password: string): Promise<UserInfo>
  metadata: Metadata
  soap: Soap
  bulk: Bulk
  describeGlobal(): Promise<Global>
  query(soql: string): Promise<QueryResult<Value>>
  queryMore(locator: string): Promise<QueryResult<Value>>
  limits(): Promise<Limits>
}
