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
  Change,
  ChangeData,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isObjectType,
  isObjectTypeChange,
  ObjectType,
  TopLevelElement,
  Values,
} from '@salto-io/adapter-api'
import { toCustomRecordTypeInstance } from '../custom_records/custom_record_type'
import { NetsuiteFilePathsQueryParams, NetsuiteTypesQueryParams, ObjectID } from '../config/types'

export interface CustomizationInfo {
  typeName: string
  values: Values
}

export interface CustomTypeInfo extends CustomizationInfo {
  scriptId: string
}

export interface TemplateCustomTypeInfo extends CustomTypeInfo {
  fileExtension: string
  fileContent: Buffer
}

export interface FileCustomizationInfo extends CustomizationInfo {
  path: string[]
  fileContent: Buffer
}

export interface FolderCustomizationInfo extends CustomizationInfo {
  path: string[]
}

export type FileCabinetCustomizationInfo = FileCustomizationInfo | FolderCustomizationInfo

export type FailedTypes = {
  unexpectedError: NetsuiteTypesQueryParams
  lockedError: NetsuiteTypesQueryParams
  excludedTypes: string[]
}

export type GetCustomObjectsResult = {
  elements: CustomTypeInfo[]
  instancesIds: ObjectID[]
  failedToFetchAllAtOnce: boolean
  failedTypes: FailedTypes
}

export type FailedFiles = {
  lockedError: NetsuiteFilePathsQueryParams
  otherError: NetsuiteFilePathsQueryParams
  largeFolderError: NetsuiteFilePathsQueryParams
}

export type ImportFileCabinetResult = {
  elements: FileCabinetCustomizationInfo[]
  failedPaths: FailedFiles
}

export type FailedImport = {
  customObject: {
    id: string
    type: string
    result: {
      code: 'FAILED'
      message: string
    }
  }
  referencedFileImportResult: unknown
}

export type ImportObjectsResult = {
  errorImports: unknown
  successfulImports: unknown
  failedImports: FailedImport[]
}

export type DataElementsResult = {
  elements: TopLevelElement[]
  requestedTypes: string[]
  largeTypesError: string[]
}

export type CustomRecordResult = {
  elements: InstanceElement[]
  largeTypesError: string[]
}

type OptionalFeature = { status: 'optional'; canBeRequired: boolean }
type RequiredFeature = { status: 'required' }
type ExcludedFeature = { status: 'excluded' }
type FeatureStatus = OptionalFeature | RequiredFeature | ExcludedFeature
export type FeaturesMap = Record<string, FeatureStatus>

export type ManifestDependencies = {
  optionalFeatures: string[]
  requiredFeatures: string[]
  excludedFeatures: string[]
  includedObjects: string[]
  excludedObjects: string[]
  includedFiles: string[]
  excludedFiles: string[]
}

export type SdfDeployParams = {
  manifestDependencies: ManifestDependencies
  validateOnly?: boolean
}

export class InvalidSuiteAppCredentialsError extends Error {
  constructor(message?: string) {
    super(message || 'Invalid SuiteApp credentials')
  }
}

export type DeployableChange = Change<ObjectType | InstanceElement>

export type SDFObjectChangeType =
  | {
      changeType: 'addition'
    }
  | {
      changeType: 'modification'
      addedObjects: Set<string>
    }

export type SDFObjectNode = {
  change: DeployableChange
  serviceid: string
  customizationInfo: CustomizationInfo
} & SDFObjectChangeType

export const getNodeId = (elemId: ElemID): string => elemId.getFullName()

export const getChangeNodeId = (change: DeployableChange): string => getNodeId(getChangeData(change).elemID)

export const getDeployableChanges = (changes: ReadonlyArray<Change>): DeployableChange[] =>
  changes.filter(change => isInstanceChange(change) || isObjectTypeChange(change)) as DeployableChange[]

export const getOrTransformCustomRecordTypeToInstance = (element: ChangeData<DeployableChange>): InstanceElement =>
  isObjectType(element) ? toCustomRecordTypeInstance(element) : element
