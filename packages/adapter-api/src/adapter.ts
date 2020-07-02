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
import {
  InstanceElement, ObjectType, Element,
} from './elements'
import { ElemID } from './element_id'
import { Change } from './change'
import { DependencyChanger } from './dependency_changer'
import { SaltoElementError } from './error'

type ChangeGroupID = string

export type ChangeGroup = {
  groupID: ChangeGroupID
  changes: ReadonlyArray<Change>
}

export interface FetchResult {
  elements: Element[]
  updatedConfig?: { config: InstanceElement; message: string }
}

export type DeployResult = {
  appliedChanges: ReadonlyArray<Change>
  errors: ReadonlyArray<Error>
}

export type AdapterOperations = {
  fetch: () => Promise<FetchResult>
  deploy: (changeGroup: ChangeGroup) => Promise<DeployResult>
}

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

export type AdapterInstallResult = {
  success: boolean
  errors: string[]
}

export type Adapter = {
  operations: (context: AdapterOperationsContext) => AdapterOperations
  validateCredentials: (config: Readonly<InstanceElement>) => Promise<AccountId>
  credentialsType: ObjectType
  configType?: ObjectType
  deployModifiers?: {
    changeValidator?: ChangeValidator
    dependencyChanger?: DependencyChanger
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
