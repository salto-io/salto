/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import {
  MetadataObject,
  DescribeValueTypeResult,
  MetadataInfo,
  SaveResult,
  UpsertResult,
  ListMetadataQuery,
  FileProperties,
  DescribeSObjectResult,
  BulkOptions,
  BulkLoadOperation,
  DescribeGlobalSObjectResult,
  DeployOptions,
  DeployResultLocator,
  DeployResult,
  RetrieveRequest,
  RetrieveResult,
  Callback,
  RetrieveResultLocator,
  UserInfo,
  QueryResult,
  Batch,
  IdentityInfo,
  Record as SfRecord,
} from '@salto-io/jsforce'
import { Value } from '@salto-io/adapter-api'

// This class is the interfaces we use from jsforce library
// It's here so we will be able to mock jsforce efficiently

export interface Metadata {
  pollInterval: number
  pollTimeout: number

  checkDeployStatus(
    id: string,
    includeDetails?: boolean,
    callback?: Callback<DeployResult>,
  ): Promise<DeployResult>
  describe(): Promise<{
    metadataObjects: MetadataObject[]
    organizationNamespace: string
  }>
  describeValueType(type: string): Promise<DescribeValueTypeResult>
  read(
    type: string,
    fullNames: string | string[],
  ): Promise<MetadataInfo | MetadataInfo[]>
  list(
    queries: ListMetadataQuery | ListMetadataQuery[],
  ): Promise<FileProperties[]>
  upsert(
    type: string,
    metadata: MetadataInfo | MetadataInfo[],
  ): Promise<UpsertResult | UpsertResult[]>
  delete(
    type: string,
    fullNames: string | string[],
  ): Promise<SaveResult | SaveResult[]>
  update(
    type: string,
    updateMetadata: MetadataInfo | MetadataInfo[],
  ): Promise<SaveResult | SaveResult[]>
  retrieve(
    request: RetrieveRequest,
    callback?: Callback<RetrieveResult>,
  ): RetrieveResultLocator<RetrieveResult>
  deploy(
    zipInput: Buffer | string | NodeJS.ReadableStream,
    options: DeployOptions,
  ): DeployResultLocator<DeployResult>
  deployRecentValidation(
    validationId: string,
  ): DeployResultLocator<DeployResult>
}

export interface Soap {
  describeSObjects(
    typeNames: string | string[],
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
  pollInterval: number
  pollTimeout: number
  load(
    type: string,
    operation: BulkLoadOperation,
    options?: BulkOptions,
    input?: SfRecord[],
  ): Batch
}

export interface Tooling {
  query(soql: string): Promise<QueryResult<Value>>
  queryMore(locator: string): Promise<QueryResult<Value>>
}

export default interface Connection {
  login(user: string, password: string): Promise<UserInfo>
  metadata: Metadata
  soap: Soap
  bulk: Bulk
  tooling: Tooling
  describeGlobal(): Promise<Global>
  query(soql: string): Promise<QueryResult<Value>>
  queryMore(locator: string): Promise<QueryResult<Value>>
  limits(): Promise<Limits>
  identity(): Promise<IdentityInfo>
  instanceUrl: string
  request(request: string): Promise<unknown>
}

type ArrayOrSingle<T> = T | T[]

export interface RunTestFailure {
  id: string
  message: string
  methodName: string
  name: string
  namespace?: string
  seeAllData?: boolean
  stackTrace: string | object
  time: number
}

export interface CodeCoverageWarning {
  id: string
  message: string
  name?: string
  namespace?: string
}

export interface RunTestsResult {
  apexLogId?: string
  codeCoverage?: ArrayOrSingle<object> // CodeCoverageResult[]
  codeCoverageWarnings?: ArrayOrSingle<CodeCoverageWarning>
  failures?: ArrayOrSingle<RunTestFailure>
  flowCoverage?: ArrayOrSingle<object> // FlowCoverageResult[]
  flowCoverageWarnings?: ArrayOrSingle<object> // FlowCoverageWarning[]
  numFailures: number
  numTestsRun: number
  successes?: ArrayOrSingle<object> // RunTestSuccess[]
  totalTime: number
}
