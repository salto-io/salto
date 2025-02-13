/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, ObjectType, Element, ReadOnlyElementsSource } from './elements'
import { AdapterAuthentication } from './authentication_types'
import { ElemID } from './element_id'
import { Change, ChangeDataType } from './change'
import { DependencyChanger } from './dependency_changer'
import { SaltoElementError, SaltoError } from './error'
import { ChangeGroup, ChangeGroupIdFunction } from './change_group'
import { Values } from './values'

export type PartialFetchData = {
  isPartial: true
  deletedElements?: ElemID[]
}

export const setPartialFetchData = (isPartial: boolean, deletedElements?: ElemID[]): PartialFetchData | undefined =>
  isPartial ? { isPartial, deletedElements } : undefined

export interface FetchResult {
  elements: Element[]
  errors?: SaltoError[]
  updatedConfig?: { config: InstanceElement[]; message: string }
  partialFetchData?: PartialFetchData
}

export type Artifact = {
  name: string
  content: Buffer
}

export type AdapterGroupProperties = {
  url?: string
  artifacts?: Artifact[]
  requestId?: string
  hash?: string
}

export type DeployExtraProperties = {
  groups?: AdapterGroupProperties[]
}

type SaltoDeployErrors = {
  errors: ReadonlyArray<SaltoError | SaltoElementError>
}

type BaseDeployResult<T extends ChangeDataType = ChangeDataType> = {
  appliedChanges: ReadonlyArray<Change<T>>
  extraProperties?: DeployExtraProperties
}

export type DeployResult<T extends ChangeDataType = ChangeDataType> = SaltoDeployErrors & BaseDeployResult<T>

export type Progress = {
  message: string
  asyncTaskId?: string
}

export type ProgressReporter = {
  reportProgress: (progress: Progress) => void
}

export type FetchOptions = {
  progressReporter: ProgressReporter
  withChangesDetection?: boolean
}

export type DeployOptions = {
  progressReporter: ProgressReporter
  changeGroup: ChangeGroup
}

export type CancelServiceAsyncTaskInput = {
  taskId: string
}

export type CancelServiceAsyncTaskResult = {
  errors: SaltoError[]
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

export type PostDeployAction = DeployAction & {
  showOnFailure?: boolean
}

export type DeployActions = {
  preAction?: DeployAction
  postAction?: PostDeployAction
}

export type ChangeError = SaltoElementError & {
  detailedMessage: string
  deployActions?: DeployActions
}

export type DependencyError = ChangeError & {
  causeID: ElemID
}

export type CircularDependencyChangeError = ChangeError & {
  cycleIDs: ElemID[]
}

export type UnresolvedReferenceError = ChangeError & {
  unresolvedElemIds: ElemID[]
}

export const isDependencyError = (err: ChangeError): err is DependencyError => 'causeID' in err

export const isCircularDependencyChangeError = (err: ChangeError): err is CircularDependencyChangeError =>
  'cycleIDs' in err

export const isUnresolvedReferenceError = (err: ChangeError): err is UnresolvedReferenceError =>
  err.type === 'unresolvedReferences' && 'unresolvedElemIds' in err

export type ChangeValidator<T extends ChangeError = ChangeError> = (
  changes: ReadonlyArray<Change>,
  elementsSource?: ReadOnlyElementsSource,
) => Promise<ReadonlyArray<T>>

export type DeployModifiers = {
  changeValidator?: ChangeValidator
  dependencyChanger?: DependencyChanger
  getChangeGroupIds?: ChangeGroupIdFunction
}

export type ValidationModifiers = Pick<DeployModifiers, 'changeValidator'>

export type FixElementsFunc = (elements: Element[]) => Promise<{
  fixedElements: Element[]
  errors: ChangeError[]
}>

export type AdapterOperations = {
  fetch: (opts: FetchOptions) => Promise<FetchResult>
  deploy: (opts: DeployOptions) => Promise<DeployResult>
  validate?: (opts: DeployOptions) => Promise<DeployResult>
  cancelServiceAsyncTask?: (opts: CancelServiceAsyncTaskInput) => Promise<CancelServiceAsyncTaskResult>
  postFetch?: (opts: PostFetchOptions) => Promise<void>
  deployModifiers?: DeployModifiers
  validationModifiers?: ValidationModifiers
  fixElements?: FixElementsFunc
}

export type AdapterOperationName = keyof AdapterOperations

export type ServiceIds = Record<string, string>

export type ElemIdGetter = (adapterName: string, serviceIds: ServiceIds, name: string) => ElemID

type AdapterBaseContext = {
  config?: InstanceElement
  getElemIdFunc?: ElemIdGetter
  elementsSource: ReadOnlyElementsSource
}

export type AdapterOperationsContext = {
  credentials: InstanceElement
  accountName?: string
} & AdapterBaseContext

export type AdapterSuccessInstallResult = {
  success: true
  installedVersion: string
  installedVersions: string[]
}

export type AdapterFailureInstallResult = {
  success: false
  errors: string[]
}

export type AdapterInstallResult = AdapterSuccessInstallResult | AdapterFailureInstallResult

export const isAdapterSuccessInstallResult = (result: AdapterInstallResult): result is AdapterSuccessInstallResult =>
  result.success

export type AccountInfo = {
  accountId: string
  accountUrl?: string
  accountType?: string
  isProduction?: boolean
  extraInformation?: Record<string, string>
}

export type ConfigCreator = {
  optionsType: (optionsContext?: Values) => ObjectType
  getConfig: (options?: InstanceElement) => Promise<InstanceElement>
}

export type IsInitializedFolderArgs = {
  baseDir: string
}

export type IsInitializedFolderResult = {
  result: boolean
  errors: ReadonlyArray<SaltoError>
}

export type InitFolderArgs = {
  baseDir: string
}

export type InitFolderResult = {
  errors: ReadonlyArray<SaltoError>
}

export type LoadElementsFromFolderArgs = {
  baseDir: string
} & AdapterBaseContext

export type DumpElementsToFolderArgs = {
  baseDir: string
  changes: ReadonlyArray<Change>
  elementsSource: ReadOnlyElementsSource
}

export type DumpElementsResult = {
  unappliedChanges: ReadonlyArray<Change>
  errors: ReadonlyArray<SaltoError | SaltoElementError>
}

export type ReferenceMapping = {
  source: ElemID
  target: ElemID
}

/**
 * @deprecated
 */
export type GetAdditionalReferencesFunc = (changes: Change[]) => Promise<ReferenceMapping[]>

export const REFERENCE_TYPES = ['strong', 'weak'] as const
export type ReferenceType = (typeof REFERENCE_TYPES)[number]

export const REFERENCE_SOURCE_SCOPES = ['baseId', 'value'] as const
export type ReferenceSourceScope = (typeof REFERENCE_SOURCE_SCOPES)[number]
export const DEFAULT_SOURCE_SCOPE: ReferenceSourceScope = 'baseId'

/**
 * **sourceScope**
 *
 * The source scope states what part of the reference source actually depends on the target.
 * - When it is "baseId" it means the existence of the whole "base element" which includes the source depends on the target
 * - When it is "value" it means that only the value specified by the sourceId depends on the target
 * - Defaults to {@link DEFAULT_SOURCE_SCOPE}
 */
export type ReferenceInfo = {
  source: ElemID
  target: ElemID
  type: ReferenceType
  sourceScope?: ReferenceSourceScope
}

export type GetCustomReferencesFunc = (elements: Element[], adapterConfig?: InstanceElement) => Promise<ReferenceInfo[]>

export type AdapterFormat = {
  isInitializedFolder?: (args: IsInitializedFolderArgs) => Promise<IsInitializedFolderResult>
  initFolder?: (args: InitFolderArgs) => Promise<InitFolderResult>
  loadElementsFromFolder?: (args: LoadElementsFromFolderArgs) => Promise<FetchResult>
  dumpElementsToFolder?: (args: DumpElementsToFolderArgs) => Promise<DumpElementsResult>
}

export type Adapter = {
  operations: (context: AdapterOperationsContext) => AdapterOperations
  validateCredentials: (config: Readonly<InstanceElement>) => Promise<AccountInfo>
  authenticationMethods: AdapterAuthentication
  configType?: ObjectType
  configCreator?: ConfigCreator
  install?: () => Promise<AdapterInstallResult>
  getAdditionalReferences?: GetAdditionalReferencesFunc
  adapterFormat?: AdapterFormat
  getCustomReferences?: GetCustomReferencesFunc
}

export const OBJECT_SERVICE_ID = 'object_service_id'
export const OBJECT_NAME = 'object_name'
export const FIELD_NAME = 'field_name'
export const INSTANCE_NAME = 'instance_name'
export const toServiceIdsString = (serviceIds: ServiceIds): string => Object.entries(serviceIds).sort().toString()
