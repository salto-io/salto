/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { Stream } from 'stream'

// This class is the interfaces we use from jsforce library
// It's here so we will be able to mock jsforce efficiently

export interface Metadata {
  pollInterval: number
  pollTimeout: number

  checkDeployStatus(id: string, includeDetails?: boolean, callback?: Callback<DeployResult>): Promise<DeployResult>
  describe(): Promise<{
    metadataObjects: MetadataObject[]
    organizationNamespace: string
  }>
  describeValueType(type: string): Promise<DescribeValueTypeResult>
  read(type: string, fullNames: string | string[]): Promise<MetadataInfo | MetadataInfo[]>
  list(queries: ListMetadataQuery | ListMetadataQuery[]): Promise<FileProperties[]>
  upsert(type: string, metadata: MetadataInfo | MetadataInfo[]): Promise<UpsertResult | UpsertResult[]>
  delete(type: string, fullNames: string | string[]): Promise<SaveResult | SaveResult[]>
  update(type: string, updateMetadata: MetadataInfo | MetadataInfo[]): Promise<SaveResult | SaveResult[]>
  retrieve(request: RetrieveRequest, callback?: Callback<RetrieveResult>): RetrieveResultLocator<RetrieveResult>
  deploy(zipInput: Buffer | string | Stream, options: DeployOptions): DeployResultLocator<DeployResult>
  deployRecentValidation(validationId: string): DeployResultLocator<DeployResult>
}

export interface Soap {
  describeSObjects(typeNames: string | string[]): Promise<DescribeSObjectResult | DescribeSObjectResult[]>
}

interface Global {
  sobjects: DescribeGlobalSObjectResult[]
}

type Limit = {
  Remaining: number
}

type Limits = {
  DailyApiRequests: Limit
}

export interface Bulk {
  pollInterval: number
  pollTimeout: number
  load(type: string, operation: BulkLoadOperation, options?: BulkOptions, input?: SfRecord[]): Batch
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
  request(
    request:
      | string
      | {
          method: string
          url: string
          headers?: Record<string, string>
          body: string
        },
  ): Promise<unknown>
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

interface CodeCoverageWarning {
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

export interface DeployMessage {
  changed: boolean
  columnNumber: number
  componentType: string
  created: boolean
  createdDate: string
  deleted: boolean
  fileName: string
  fullName: string
  id: string | undefined
  lineNumber: number
  problem: string
  problemType: string
  success: boolean
}
