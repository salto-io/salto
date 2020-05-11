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
  MetadataObject, ValueTypeField, MetadataInfo, SaveResult, UpsertResult,
  ListMetadataQuery, FileProperties, DescribeSObjectResult,
  DescribeGlobalSObjectResult, DeployOptions, DeployResultLocator, DeployResult,
  RetrieveRequest, RetrieveResult, Callback, RetrieveResultLocator, UserInfo,
} from 'jsforce'

// This class is the interfaces we use from jsforce library
// It's here so we will be able to mock jsforce efficiently

export interface Metadata {
  describe(): Promise<{ metadataObjects: MetadataObject[] }>
  describeValueType(type: string): Promise<{ valueTypeFields: ValueTypeField[] }>
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

export default interface Connection {
  login(
    user: string, password: string, callback?: (err: Error, res: UserInfo) => void
  ): Promise<unknown>
  metadata: Metadata
  soap: Soap
  describeGlobal(): Promise<Global>
  limits(): Promise<Limits>
}
