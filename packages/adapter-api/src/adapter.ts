/*
*                      Copyright 2023 Salto Labs Ltd.
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
  InstanceElement, ObjectType, Element, ReadOnlyElementsSource,
} from './elements'
import { AdapterAuthentication } from './authentication_types'
import { ElemID } from './element_id'
import { Change } from './change'
import { DependencyChanger } from './dependency_changer'
import { SaltoElementError, SaltoError } from './error'
import { ChangeGroup, ChangeGroupIdFunction } from './change_group'

export interface FetchResult {
  elements: Element[]
  errors?: SaltoError[]
  updatedConfig?: { config: InstanceElement[]; message: string }
  isPartial?: boolean
}

export type Group = {
  id?: string
  requestId?: string
  hash?: string
  url?: string
}

export type DeployExtraProperties = {
  deploymentUrls?: string[]
  groups?: Group[]
}

export type DeployResult = {
  appliedChanges: ReadonlyArray<Change>
  errors: ReadonlyArray<Error>
  extraProperties?: DeployExtraProperties
}

export type Progress = {
  message: string
}

export type ProgressReporter = {
  reportProgress: (progress: Progress) => void
}

export type FetchOptions = {
  progressReporter: ProgressReporter
  withChangesDetection?: boolean
}

export type DeployOptions = {
  changeGroup: ChangeGroup
}

export type PostFetchOptions = {
  currentAdapterElements: Element[]
  elementsByAccount: Readonly<Record<string, ReadonlyArray<Readonly<Element>>>>
  accountToServiceNameMap?: Record<string, string>
  progressReporter: ProgressReporter
}

export type DeployAction = {
  title: string
  description?: string
  subActions: string[]
  documentationURL?: string
}

export type DeployActions = {
  preAction?: DeployAction
  postAction?: DeployAction
}

export type ChangeError = SaltoElementError & {
  detailedMessage: string
  deployActions?: DeployActions
}

export type DependencyError = ChangeError & {
  causeID: ElemID
}

export const isDependencyError = (err: ChangeError): err is DependencyError => 'causeID' in err

export type ChangeValidator = (
  changes: ReadonlyArray<Change>, elementsSource?: ReadOnlyElementsSource
) => Promise<ReadonlyArray<ChangeError>>

export type DeployModifiers = {
  changeValidator?: ChangeValidator
  dependencyChanger?: DependencyChanger
  getChangeGroupIds?: ChangeGroupIdFunction
}

export type ValidationModifiers = Pick<DeployModifiers, 'changeValidator'>

export type AdapterOperations = {
  fetch: (opts: FetchOptions) => Promise<FetchResult>
  deploy: (opts: DeployOptions) => Promise<DeployResult>
  validate?: (opts: DeployOptions) => Promise<DeployResult>
  postFetch?: (opts: PostFetchOptions) => Promise<void>
  deployModifiers?: DeployModifiers
  validationModifiers?: ValidationModifiers
}

export type AdapterOperationName = keyof AdapterOperations

export type ServiceIds = Record<string, string>

export type ElemIdGetter = (adapterName: string, serviceIds: ServiceIds, name: string) => ElemID

export type AdapterOperationsContext = {
  credentials: InstanceElement
  config?: InstanceElement
  getElemIdFunc?: ElemIdGetter
  elementsSource: ReadOnlyElementsSource
}

export type AdapterSuccessInstallResult = { success: true; installedVersion: string }
export type AdapterFailureInstallResult = { success: false; errors: string[] }
export type AdapterInstallResult = AdapterSuccessInstallResult | AdapterFailureInstallResult

export const isAdapterSuccessInstallResult = (result: AdapterInstallResult):
  result is AdapterSuccessInstallResult => result.success

export type AccountId = string

export type ConfigCreator = {
  optionsType: ObjectType
  getConfig: (options?: InstanceElement)
    => Promise<InstanceElement>
}

export type Adapter = {
  operations: (context: AdapterOperationsContext) => AdapterOperations
  validateCredentials: (config: Readonly<InstanceElement>) => Promise<AccountId>
  authenticationMethods: AdapterAuthentication
  configType?: ObjectType
  configCreator?: ConfigCreator
  install?: () => Promise<AdapterInstallResult>
}

export const OBJECT_SERVICE_ID = 'object_service_id'
export const OBJECT_NAME = 'object_name'
export const FIELD_NAME = 'field_name'
export const INSTANCE_NAME = 'instance_name'
export const toServiceIdsString = (serviceIds: ServiceIds): string =>
  Object.entries(serviceIds).sort().toString()
