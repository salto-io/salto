/*
*                      Copyright 2021 Salto Labs Ltd.
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
  InstanceElement, ObjectType, Element,
} from './elements'
import { AdapterAuthentication } from './authentication_types'
import { ElemID } from './element_id'
import { Change } from './change'
import { DependencyChanger } from './dependency_changer'
import { SaltoElementError } from './error'
import { ChangeGroup, ChangeGroupIdFunction } from './change_group'

export interface FetchResult {
  elements: Element[]
  updatedConfig?: { config: InstanceElement; message: string }
  isPartial?: boolean
}

export type DeployResult = {
  appliedChanges: ReadonlyArray<Change>
  errors: ReadonlyArray<Error>
}

export type Progress = {
  message: string
}

export type ProgressReporter = {
  reportProgress: (progress: Progress) => void
}

export type FetchOptions = {
  progressReporter: ProgressReporter
}

export type DeployOptions = {
  changeGroup: ChangeGroup
}

export type AdapterOperations = {
  fetch: (opts: FetchOptions) => Promise<FetchResult>
  deploy: (opts: DeployOptions) => Promise<DeployResult>
}

export type AdapterOperationName = keyof AdapterOperations

export type AdapterOperationsContext = {
  credentials: InstanceElement
  config?: InstanceElement
  getElemIdFunc?: ElemIdGetter
}

export type ChangeError = SaltoElementError & {
  detailedMessage: string
}

export type ChangeValidator = (changes: ReadonlyArray<Change>) =>
  Promise<ReadonlyArray<ChangeError>>

export type AdapterSuccessInstallResult = { success: true; installedVersion: string }
export type AdapterFailureInstallResult = { success: false; errors: string[] }
export type AdapterInstallResult = AdapterSuccessInstallResult | AdapterFailureInstallResult

export const isAdapterSuccessInstallResult = (result: AdapterInstallResult):
  result is AdapterSuccessInstallResult => result.success

export type Adapter = {
  operations: (context: AdapterOperationsContext) => AdapterOperations
  validateCredentials: (config: Readonly<InstanceElement>) => Promise<AccountId>
  authenticationMethods: AdapterAuthentication
  configType?: ObjectType
  deployModifiers?: {
    changeValidator?: ChangeValidator
    dependencyChanger?: DependencyChanger
    getChangeGroupIds?: ChangeGroupIdFunction
  }
  install?: () => Promise<AdapterInstallResult>
}

export const OBJECT_SERVICE_ID = 'object_service_id'
export const ADAPTER = 'adapter'
export const OBJECT_NAME = 'object_name'
export const FIELD_NAME = 'field_name'
export const INSTANCE_NAME = 'instance_name'
export type ServiceIds = Record<string, string>
export const toServiceIdsString = (serviceIds: ServiceIds): string =>
  Object.entries(serviceIds).sort().toString()
export type ElemIdGetter = (adapterName: string, serviceIds: ServiceIds, name: string) => ElemID
export type AccountId = string
