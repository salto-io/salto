/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import path from 'path'
import {
  Element,
  SaltoError,
  SaltoElementError,
  ElemID,
  InstanceElement,
  DetailedChange,
  Change,
  Value,
  toChange,
  isRemovalChange,
  getChangeData,
  isField,
  AuthorInformation,
  ReferenceInfo,
  ReferenceType,
  ReadOnlyElementsSource,
  StaticFile,
  isInstanceElement,
  isObjectType,
  isModificationChange,
  TypeReference,
  DEFAULT_SOURCE_SCOPE,
  isAdditionOrModificationChange,
  DetailedChangeWithBaseChange,
  Adapter,
  GLOBAL_ADAPTER,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import {
  applyDetailedChanges,
  getIndependentElemIDs,
  inspectValue,
  naclCase,
  safeJsonStringify,
} from '@salto-io/adapter-utils'
import { collections, promises, values } from '@salto-io/lowerdash'
import { parser } from '@salto-io/parser'
import { ValidationError, isUnresolvedRefError, validateElements } from '../validator'
import { ConfigSource } from './config_source'
import { State } from './state'
import {
  multiEnvSource,
  getSourceNameForFilename,
  MultiEnvSource,
  EnvsChanges,
  FromSource,
  ENVS_PREFIX,
} from './nacl_files/multi_env/multi_env_source'
import { NaclFilesSource, NaclFile, RoutingMode } from './nacl_files/nacl_files_source'
import { ParsedNaclFile } from './nacl_files/parsed_nacl_file'
import { ElementSelector } from './element_selector'
import {
  Errors,
  AccountDuplicationError,
  EnvDuplicationError,
  UnknownEnvError,
  DeleteCurrentEnvError,
  InvalidEnvNameError,
  MAX_ENV_NAME_LEN,
  UnknownAccountError,
  InvalidAccountNameError,
  MAX_ACCOUNT_NAME_LENGTH,
} from './errors'
import { EnvConfig, StateConfig } from './config/workspace_config_types'
import { handleHiddenChanges, getElementHiddenParts, isHidden } from './hidden_values'
import { WorkspaceConfigSource } from './workspace_config_source'
import { MergeError, mergeElements } from '../merger'
import { RemoteElementSource, ElementsSource, mapReadOnlyElementsSource } from './elements_source'
import {
  createMergeManager,
  ElementMergeManager,
  ChangeSet,
  createEmptyChangeSet,
  MergedRecoveryMode,
  RecoveryOverrideFunc,
} from './nacl_files/elements_cache'
import { ReadOnlyRemoteMap, RemoteMap, RemoteMapCreator } from './remote_map'
import {
  serialize,
  deserializeMergeErrors,
  deserializeSingleElement,
  deserializeValidationErrors,
} from '../serializer/elements'
import { AdaptersConfigSource } from './adapters_config_source'
import {
  isSerliazedReferenceIndexEntry,
  ReferenceIndexEntry,
  ReferenceTargetIndexValue,
  updateReferenceIndexes,
} from './reference_indexes'
import { updateChangedByIndex, Author, authorKeyToAuthor, authorToAuthorKey } from './changed_by_index'
import { updateChangedAtIndex } from './changed_at_index'
import { updateReferencedStaticFilesIndex } from './static_files_index'
import { resolve } from '../expressions'
import { updateAliasIndex } from './alias_index'
import { updateAuthorInformationIndex } from './author_information_index'
import { getDependents } from './dependents'

const log = logger(module)

const { makeArray } = collections.array
const { awu } = collections.asynciterable
const { partition } = promises.array

export const COMMON_ENV_PREFIX = ''
const MULTI_ENV_SOURCE_PREFIX = 'multi_env_element_source'
const STATE_SOURCE_PREFIX = 'state_element_source'

export const getBaseDirFromEnvName = (envName: string): string =>
  envName === COMMON_ENV_PREFIX ? envName : path.join(ENVS_PREFIX, envName)

export const getStaticFileCacheName = (name: string): string => (name === COMMON_ENV_PREFIX ? 'common' : name)

export const isValidEnvName = (envName: string): boolean =>
  /^[a-z0-9-_.!\s]+$/i.test(envName) && envName.length <= MAX_ENV_NAME_LEN

export const isValidAccountName = (accountName: string): boolean =>
  accountName.length <= MAX_ACCOUNT_NAME_LENGTH && naclCase(accountName) === accountName && /^\D.*$/i.test(accountName)

export type DateRange = {
  start: Date
  end?: Date
}

export type SourceLocation = {
  sourceRange: parser.SourceRange
  subRange?: parser.SourceRange
}

export type WorkspaceError<T extends SaltoError> = Readonly<
  T & {
    sourceLocations: SourceLocation[]
  }
>

export type WorkspaceComponents = {
  nacl: boolean
  state: boolean
  cache: boolean
  staticResources: boolean
  credentials: boolean
  accountConfig: boolean
}

export type ClearFlags = Omit<WorkspaceComponents, 'accountConfig'>

export type UnresolvedElemIDs = {
  found: ElemID[]
  missing: ElemID[]
}

export type UpdateNaclFilesResult = {
  naclFilesChangesCount: number
  stateOnlyChangesCount: number
}

// common source has no state
export type EnvironmentSource = { naclFiles: NaclFilesSource; state?: State }
export type EnvironmentsSources = {
  commonSourceName: string
  sources: Record<string, EnvironmentSource>
}

export type FromSourceWithEnv = {
  source: 'env'
  envName?: string
}

type IncomingReferenceInfo = {
  id: ReferenceInfo['source']
} & Required<Pick<ReferenceInfo, 'type' | 'sourceScope'>>

const isFromSourceWithEnv = (value: { source: FromSource } | FromSourceWithEnv): value is FromSourceWithEnv =>
  value.source === 'env'

export type Workspace = {
  uid: string

  elements: (includeHidden?: boolean, env?: string) => Promise<ElementsSource>
  state: (envName?: string) => State
  envs: () => ReadonlyArray<string>
  currentEnv: () => string
  accounts: (env?: string) => string[]
  // services is deprecated, kept for backwards compatibility. use accounts.
  // Remove this when no longer used, SALTO-1661
  services: (env?: string) => string[]
  accountCredentials: (names?: ReadonlyArray<string>) => Promise<Readonly<Record<string, InstanceElement>>>
  // servicesCredentials is deprecated, kept for backwards compatibility.
  // use accountsCredentials.
  // Remove this when no longer used, SALTO-1661
  servicesCredentials: (names?: ReadonlyArray<string>) => Promise<Readonly<Record<string, InstanceElement>>>
  accountConfig: (
    name: string,
    defaultValue?: InstanceElement,
    shouldResolve?: boolean,
  ) => Promise<InstanceElement | undefined>
  // serviceConfig is deprecated, kept for backwards compatibility.
  // use accountConfig.
  // Remove this when no longer used, SALTO-1661
  serviceConfig: (name: string, defaultValue?: InstanceElement) => Promise<InstanceElement | undefined>
  accountConfigPaths: (name: string) => Promise<string[]>
  close: () => Promise<void>
  // serviceConfigPaths is deprecated, kept for backwards compatibility.
  // use accountConfigPaths.
  // Remove this when no longer used, SALTO-1661
  serviceConfigPaths: (name: string) => Promise<string[]>
  isEmpty(naclFilesOnly?: boolean): Promise<boolean>
  // hasElementsInServices is deprecated, kept for backwards compatibility.
  // use hasElementsInAccounts.
  // Remove this when no longer used, SALTO-1661
  hasElementsInServices(serviceNames: string[]): Promise<boolean>
  hasElementsInAccounts(accountNames: string[]): Promise<boolean>
  hasElementsInEnv(envName: string): Promise<boolean>
  envOfFile(filename: string): string
  hasErrors(env?: string): Promise<boolean>
  errors(): Promise<Readonly<Errors>>
  transformToWorkspaceError<T extends SaltoElementError>(saltoElemErr: T): Promise<Readonly<WorkspaceError<T>>>
  transformError: (error: SaltoError) => Promise<WorkspaceError<SaltoError>>
  updateNaclFiles: (
    changes: DetailedChangeWithBaseChange[],
    mode?: RoutingMode,
    stateOnly?: boolean,
  ) => Promise<UpdateNaclFilesResult>
  listNaclFiles: () => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  setNaclFiles: (naclFiles: NaclFile[], validate?: boolean) => Promise<EnvsChanges>
  removeNaclFiles: (names: string[], validate?: boolean) => Promise<EnvsChanges>
  getSourceMap: (filename: string) => Promise<parser.SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<parser.SourceRange[]>
  getReferenceSourcesIndex: (envName?: string) => Promise<ReadOnlyRemoteMap<ReferenceIndexEntry[]>>
  getElementOutgoingReferences: (
    id: ElemID,
    envName?: string,
    includeWeakReferences?: boolean,
  ) => Promise<Required<ReferenceIndexEntry>[]>
  getElementIncomingReferences: (id: ElemID, envName?: string) => Promise<ElemID[]>
  getElementIncomingReferenceInfos: (id: ElemID, envName?: string) => Promise<IncomingReferenceInfo[]>
  getElementAuthorInformation: (id: ElemID, envName?: string) => Promise<AuthorInformation>
  getElementsAuthorsById: (envName?: string) => Promise<Record<string, AuthorInformation>>
  getAllChangedByAuthors: (envName?: string) => Promise<Author[]>
  getChangedElementsByAuthors: (authors: Author[], envName?: string) => Promise<ElemID[]>
  getElementNaclFiles: (id: ElemID) => Promise<string[]>
  getElementIdsBySelectors: (
    selectors: ElementSelector[],
    from:
      | FromSourceWithEnv
      | {
          source: FromSource
        },
    compact?: boolean,
  ) => Promise<AsyncIterable<ElemID>>
  getElementFileNames: (env?: string) => Promise<Map<string, string[]>>
  getParsedNaclFile: (filename: string) => Promise<ParsedNaclFile | undefined>
  flush: () => Promise<void>
  clone: () => Promise<Workspace>
  clear: (args: ClearFlags) => Promise<void>
  addAccount: (service: string, account?: string) => Promise<void>
  // addService is deprecated, kept for backwards compatibility. use addAccount.
  // Remove this when no longer used, SALTO-1661
  addService: (service: string, account?: string) => Promise<void>
  addEnvironment: (
    env: string,
    environmentSourceCreator: (rmc: RemoteMapCreator) => Promise<EnvironmentSource>,
  ) => Promise<void>
  deleteEnvironment: (env: string, keepNacls?: boolean) => Promise<void>
  renameEnvironment: (envName: string, newEnvName: string, newSourceName?: string) => Promise<void>
  setCurrentEnv: (env: string, persist?: boolean) => Promise<void>
  updateStateProvider: (stateConfig: StateConfig | undefined) => Promise<void>
  updateAccountCredentials: (account: string, creds: Readonly<InstanceElement>) => Promise<void>
  // updateServiceCredentials is deprecated, kept for backwards compatibility.
  // use updateAccountCredentials.
  // Remove this when no longer used, SALTO-1661
  updateServiceCredentials: (service: string, creds: Readonly<InstanceElement>) => Promise<void>
  updateAccountConfig: (
    adapter: string,
    newConfig: Readonly<InstanceElement> | Readonly<InstanceElement>[],
    account?: string,
  ) => Promise<void>
  // updateServiceConfig is deprecated, kept for backwards compatibility.
  // use updateAccountConfig.
  // Remove this when no longer used, SALTO-1661
  updateServiceConfig: (
    adapter: string,
    newConfig: Readonly<InstanceElement> | Readonly<InstanceElement>[],
    account?: string,
  ) => Promise<void>
  getServiceFromAccountName: (account: string) => string
  promote(idsToMove: ElemID[], idsToRemove?: Record<string, ElemID[]>): Promise<void>
  demote(ids: ElemID[]): Promise<void>
  demoteAll(): Promise<void>
  copyTo(ids: ElemID[], targetEnvs?: string[]): Promise<void>
  sync(idsToCopy: ElemID[], idsToRemove: Record<string, ElemID[]>, targetEnvs: string[]): Promise<void>
  getValue(id: ElemID): Promise<Value | undefined>
  getSearchableNames(): Promise<string[]>
  getSearchableNamesOfEnv(env?: string): Promise<string[]>
  listUnresolvedReferences(completeFromEnv?: string): Promise<UnresolvedElemIDs>
  getElementSourceOfPath(filePath: string, includeHidden?: boolean): Promise<ReadOnlyElementsSource>
  getFileEnvs(filePath: string): { envName: string; isStatic?: boolean }[]
  getStaticFile(params: {
    filepath: string
    encoding: BufferEncoding
    env?: string
    isTemplate?: boolean
    hash?: string
  }): Promise<StaticFile | undefined>
  getStaticFilePathsByElemIds(elementIds: ElemID[], envName?: string): Promise<string[]>
  getElemIdsByStaticFilePaths(filePaths?: Set<string>, envName?: string): Promise<Record<string, string>>
  getAliases(envName?: string): Promise<ReadOnlyRemoteMap<string>>
  getChangedElementsBetween(dateRange: DateRange, envName?: string): Promise<ElemID[]>
  isChangedAtIndexEmpty(envName?: string): Promise<boolean>
}

type SingleState = {
  merged: ElementsSource
  errors: RemoteMap<MergeError[]>
  validationErrors: RemoteMap<ValidationError[]>
  changedBy: RemoteMap<ElemID[]>
  changedAt: RemoteMap<ElemID[]>
  authorInformation: RemoteMap<AuthorInformation>
  alias: RemoteMap<string>
  referencedStaticFiles: RemoteMap<string[]>
  referenceSources: RemoteMap<ReferenceIndexEntry[]>
  referenceTargets: RemoteMap<ReferenceTargetIndexValue>
  mapVersions: RemoteMap<number>
}
type WorkspaceState = {
  states: Record<string, SingleState>
  mergeManager: ElementMergeManager
}
/**
 * Filter out descendants from a list of sorted elem ids.
 *
 * @param sortedIds   The list of elem id full names, sorted alphabetically
 */
const compact = (sortedIds: ElemID[]): ElemID[] => {
  const ret = sortedIds.slice(0, 1)
  sortedIds.slice(1).forEach(id => {
    const lastItem = _.last(ret) as ElemID // if we're in the loop then ret is not empty
    if (!lastItem.isParentOf(id)) {
      ret.push(id)
    }
  })
  return ret
}

export const serializeReferenceSourcesEntries = async (entries: ReferenceIndexEntry[]): Promise<string> =>
  safeJsonStringify(entries.map(entry => ({ ...entry, id: entry.id.getFullName() })))

let hasLoggedOldFormatWarning = false
export const deserializeReferenceSourcesEntries = async (data: string): Promise<ReferenceIndexEntry[]> => {
  const parsedEntries: unknown = JSON.parse(data)
  if (!Array.isArray(parsedEntries)) {
    log.warn('failed to deserizlize reference sources entries. Parsed Entries: %s', inspectValue(parsedEntries))
    throw new Error('Failed to deserialize reference sources entries')
  }
  // Handle old format
  if (parsedEntries.some(_.isString)) {
    // Avoid spammy log, since when we reach here it will be invoked for each key in the index.
    if (!hasLoggedOldFormatWarning) {
      log.debug('Deserializing old reference sources entries format')
      hasLoggedOldFormatWarning = true
    }
    return parsedEntries.map(id => ({ id: ElemID.fromFullName(id), type: 'strong' }))
  }
  if (parsedEntries.some(isSerliazedReferenceIndexEntry)) {
    return parsedEntries.map(entry => ({ ...entry, id: ElemID.fromFullName(entry.id) }))
  }
  log.warn('failed to deserizlize reference sources entries. Parsed Entries: %s', inspectValue(parsedEntries))
  throw new Error('Failed to deserialize reference sources entries')
}

/**
 * Serialize a reference tree to a JSON of path (without baseId) to ElemID
 * example: (adapter.type.instance.instanceName.)field.nestedField -> ElemID
 */
export const serializeReferenceTree = async (val: ReferenceTargetIndexValue): Promise<string> => {
  const entriesToSerialize = Array.from(val.entries()).map(([key, refs]) => [
    key,
    refs.map(ref => ({ ...ref, id: ref.id.getFullName() })),
  ])
  return safeJsonStringify(entriesToSerialize)
}

export const deserializeReferenceTree = async (data: string): Promise<ReferenceTargetIndexValue> => {
  const parsedEntries = JSON.parse(data)

  // Backwards compatibility for old serialized data, should be removed in the future
  const isOldListFormat = Array.isArray(parsedEntries) && parsedEntries.length > 0 && _.isString(parsedEntries[0])

  const entries = isOldListFormat ? [['', parsedEntries]] : parsedEntries

  const elemIdsEntries = entries.map(([key, refs]: [string, (string | { id: string; type: ReferenceType })[]]) => [
    key,
    refs.map(ref => {
      // Backwards compatibility for old serialized data, should be removed in the future
      if (_.isString(ref)) {
        return { id: ElemID.fromFullName(ref), type: 'strong' }
      }

      return { ...ref, id: ElemID.fromFullName(ref.id) }
    }),
  ])
  return new collections.treeMap.TreeMap(elemIdsEntries)
}

/*
 * List dependecies for a given list of elemIDs within a workspace in envToListFrom.
 * Filters out weak references and any elemIDs from elemIDsToSkip.
 */
export const listElementsDependenciesInWorkspace = async ({
  workspace,
  elemIDsToFind,
  elemIDsToSkip = [],
  envToListFrom,
}: {
  workspace: Workspace
  elemIDsToFind: ElemID[]
  elemIDsToSkip?: ElemID[]
  envToListFrom?: string
}): Promise<{ dependencies: Record<string, ElemID[]>; missing: ElemID[] }> =>
  log.timeDebug(async () => {
    const workspaceBaseLevelIds = await log.timeDebug(
      async () => new Set(await workspace.getSearchableNamesOfEnv(envToListFrom)),
      `getSearchableNames for env: ${envToListFrom}`,
    )
    const elemIdsToSkipSet = new Set(elemIDsToSkip.map(id => id.getFullName()))
    const baseLevelIds = elemIDsToFind.map(id => id.createBaseID().parent)
    const [foundIds, missingIds] = _.partition(baseLevelIds, elemID => workspaceBaseLevelIds.has(elemID.getFullName()))

    const result: Record<string, ElemID[]> = {}
    const elemIDsToProcess = Array.from(foundIds)
    const visited: Set<string> = new Set()
    while (elemIDsToProcess.length > 0) {
      const currentLevelIds = elemIDsToProcess
        .splice(0, elemIDsToProcess.length)
        .filter(currentId => !visited.has(currentId.getFullName()))
      currentLevelIds.forEach(currentId => visited.add(currentId.getFullName()))

      log.trace('Proccessing %d elements references', currentLevelIds.length)
      // eslint-disable-next-line no-await-in-loop
      const currentLevelResult = await Promise.all(
        currentLevelIds.map(async currentId => {
          const references = await workspace.getElementOutgoingReferences(currentId, envToListFrom, false)
          const relevantElemIds = getIndependentElemIDs(
            references
              .map(ref => ref.id.createBaseID().parent)
              .filter(elemId => !elemIdsToSkipSet.has(elemId.getFullName())),
          )

          const [foundElemIDs, missingElemIDs] = _.partition(relevantElemIds, elemID =>
            workspaceBaseLevelIds.has(elemID.getFullName()),
          )
          result[currentId.getFullName()] = foundElemIDs
          return { foundElemIDs, missingElemIDs }
        }),
      )
      currentLevelResult.flatMap(entry => entry.missingElemIDs).forEach(id => missingIds.push(id))

      _(currentLevelResult)
        .flatMap(entry => entry.foundElemIDs)
        .uniqBy(id => id.getFullName())
        .forEach(id => elemIDsToProcess.push(id))

      log.trace('Done proccessing references for %d elements', currentLevelIds.length)
    }

    return { dependencies: result, missing: _.uniqBy(missingIds, id => id.getFullName()) }
  }, 'List dependencies in workspace')

export type WorkspaceGetCustomReferencesFunc = (
  elements: Element[],
  accountToServiceName: Record<string, string>,
  adaptersConfig: AdaptersConfigSource,
) => Promise<ReferenceInfo[]>

const toReferenceIndexEntryWithDefaults = (
  referenceIndexEntry: ReferenceIndexEntry,
): Required<ReferenceIndexEntry> => ({
  ...referenceIndexEntry,
  sourceScope: referenceIndexEntry.sourceScope ?? DEFAULT_SOURCE_SCOPE,
})

const logValidationErrors = (errors: ReadonlyArray<ValidationError>, source: string): void => {
  _(errors)
    .groupBy(error => error.constructor.name)
    .entries()
    .forEach(([errorType, errorsGroup]) => {
      log.warn(
        'Invalid %s, error type %s, severity: %s element IDs: %o',
        source,
        errorType,
        errorsGroup[0].severity,
        errorsGroup.map(e => e.elemID.getFullName()),
      )
    })
}

export const getCustomReferencesImplementation = (
  adapterCreators: Record<string, Adapter>,
): WorkspaceGetCustomReferencesFunc | undefined => {
  if (_.isEmpty(Object.keys(adapterCreators))) {
    return undefined
  }
  return async function getCustomReferences(
    elements: Element[],
    accountToServiceName: Record<string, string>,
    adaptersConfig: AdaptersConfigSource,
  ): Promise<ReferenceInfo[]> {
    const accountElementsToRefs = async ([account, accountElements]: [string, Element[]]): Promise<ReferenceInfo[]> => {
      const serviceName = accountToServiceName[account] ?? account
      try {
        const refFunc = adapterCreators[serviceName]?.getCustomReferences
        if (refFunc !== undefined) {
          return await refFunc(accountElements, await adaptersConfig.getAdapter(account))
        }
      } catch (err) {
        log.error('failed to get custom references for %s: %o', account, err)
      }
      return []
    }

    const accountToElements = _.groupBy(
      elements.filter(e => e.elemID.adapter !== GLOBAL_ADAPTER),
      e => e.elemID.adapter,
    )
    return (await Promise.all(Object.entries(accountToElements).map(accountElementsToRefs))).flat()
  }
}

type LoadWorkspaceParams = {
  config: WorkspaceConfigSource
  adaptersConfig: AdaptersConfigSource
  credentials: ConfigSource
  environmentsSources: EnvironmentsSources
  remoteMapCreator: RemoteMapCreator
  ignoreFileChanges?: boolean
  persistent?: boolean
  mergedRecoveryMode?: MergedRecoveryMode
  adapterCreators: Record<string, Adapter>
}

export async function loadWorkspace(params: LoadWorkspaceParams): Promise<Workspace> {
  const {
    config,
    adaptersConfig,
    credentials,
    environmentsSources,
    remoteMapCreator,
    ignoreFileChanges = false,
    persistent = true,
    mergedRecoveryMode = 'rebuild',
    adapterCreators,
  } = params

  const getCustomReferences = getCustomReferencesImplementation(adapterCreators) ?? (async () => [])

  const workspaceConfig = await config.getWorkspaceConfig()
  log.debug('Loading workspace with id: %s', workspaceConfig.uid)

  if (_.isEmpty(workspaceConfig.envs)) {
    throw new Error('Workspace with no environments is illegal')
  }
  const envs = (): ReadonlyArray<string> => workspaceConfig.envs.map(e => e.name)
  let overrideEnv: string
  const currentEnv = (): string => overrideEnv ?? workspaceConfig.currentEnv ?? workspaceConfig.envs[0].name
  const getRemoteMapNamespace = (namespace: string, env?: string): string =>
    `workspace-${env || currentEnv()}-${namespace}`
  const currentEnvConf = (): EnvConfig =>
    makeArray(workspaceConfig.envs).find(e => e.name === currentEnv()) as EnvConfig
  const currentEnvsConf = (): EnvConfig[] => workspaceConfig.envs
  const accounts = (env?: string): string[] => {
    const envConf = env ? makeArray(workspaceConfig.envs).find(e => e.name === env) : currentEnvConf()
    return makeArray(Object.keys(envConf?.accountToServiceName || {}))
  }
  const state = (envName?: string): State => environmentsSources.sources[envName ?? currentEnv()].state as State
  let naclFilesSource = multiEnvSource(
    _.mapValues(environmentsSources.sources, e => e.naclFiles),
    environmentsSources.commonSourceName,
    remoteMapCreator,
    persistent,
    mergedRecoveryMode,
  )
  let workspaceState: Promise<WorkspaceState> | undefined
  const buildWorkspaceState = async ({
    workspaceChanges,
    stateOnlyChanges = {},
    validate = true,
  }: {
    workspaceChanges?: Record<string, ChangeSet<Change>>
    stateOnlyChanges?: Record<string, ChangeSet<Change>>
    validate?: boolean
  }): Promise<WorkspaceState> =>
    log.timeDebug(async () => {
      const initState = async (): Promise<WorkspaceState> => {
        const wsConfig = await config.getWorkspaceConfig()
        log.debug('initializing state for workspace %s', wsConfig.uid)
        log.debug('Full workspace config: %o', wsConfig)
        const states: Record<string, SingleState> = Object.fromEntries(
          await awu(envs())
            .map(async envName => [
              envName,
              {
                merged: new RemoteElementSource(
                  await remoteMapCreator.create<Element>({
                    namespace: getRemoteMapNamespace('merged', envName),
                    serialize: element => serialize([element], 'keepRef'),
                    // TODO: we might need to pass static file reviver to the deserialization func
                    deserialize: s =>
                      deserializeSingleElement(
                        s,
                        async staticFile =>
                          (await naclFilesSource.getStaticFile({
                            filePath: staticFile.filepath,
                            encoding: staticFile.encoding,
                            env: envName,
                            isTemplate: staticFile.isTemplate,
                            hash: staticFile.hash,
                          })) ?? staticFile,
                      ),
                    persistent,
                  }),
                ),
                errors: await remoteMapCreator.create<MergeError[]>({
                  namespace: getRemoteMapNamespace('errors', envName),
                  serialize: mergeErrors => serialize(mergeErrors, 'keepRef'),
                  deserialize: async data => deserializeMergeErrors(data),
                  persistent,
                }),
                validationErrors: await remoteMapCreator.create<ValidationError[]>({
                  namespace: getRemoteMapNamespace('validationErrors', envName),
                  serialize: validationErrors => serialize(validationErrors, 'keepRef'),
                  deserialize: async data => deserializeValidationErrors(data),
                  persistent,
                }),
                changedBy: await remoteMapCreator.create<ElemID[]>({
                  namespace: getRemoteMapNamespace('changedBy', envName),
                  serialize: async val => safeJsonStringify(val.map(id => id.getFullName())),
                  deserialize: data => JSON.parse(data).map((id: string) => ElemID.fromFullName(id)),
                  persistent,
                }),
                changedAt: await remoteMapCreator.create<ElemID[]>({
                  namespace: getRemoteMapNamespace('changedAt', envName),
                  serialize: async val => safeJsonStringify(val.map(id => id.getFullName())),
                  deserialize: data => JSON.parse(data).map((id: string) => ElemID.fromFullName(id)),
                  persistent,
                }),
                authorInformation: await remoteMapCreator.create<AuthorInformation>({
                  namespace: getRemoteMapNamespace('authorInformation', envName),
                  serialize: async val => safeJsonStringify(val),
                  deserialize: data => JSON.parse(data),
                  persistent,
                }),
                alias: await remoteMapCreator.create<string>({
                  namespace: getRemoteMapNamespace('alias', envName),
                  serialize: async val => safeJsonStringify(val),
                  deserialize: data => JSON.parse(data),
                  persistent,
                }),
                referencedStaticFiles: await remoteMapCreator.create<string[]>({
                  namespace: getRemoteMapNamespace('referencedStaticFiles', envName),
                  serialize: async val => safeJsonStringify(val),
                  deserialize: data => JSON.parse(data),
                  persistent,
                }),
                referenceSources: await remoteMapCreator.create<ReferenceIndexEntry[]>({
                  namespace: getRemoteMapNamespace('referenceSources', envName),
                  serialize: serializeReferenceSourcesEntries,
                  deserialize: deserializeReferenceSourcesEntries,
                  persistent,
                }),
                referenceTargets: await remoteMapCreator.create<ReferenceTargetIndexValue>({
                  namespace: getRemoteMapNamespace('referenceTargets', envName),
                  serialize: serializeReferenceTree,
                  deserialize: deserializeReferenceTree,
                  persistent,
                }),
                mapVersions: await remoteMapCreator.create<number>({
                  namespace: getRemoteMapNamespace('mapVersions', envName),
                  serialize: async val => val.toString(),
                  deserialize: async data => parseInt(data, 10),
                  persistent,
                }),
              },
            ])
            .toArray(),
        )
        const sources: Record<string, ReadOnlyElementsSource> = {}
        await awu(envs()).forEach(async envName => {
          const naclSource = await naclFilesSource.getElementsSource(envName)
          sources[MULTI_ENV_SOURCE_PREFIX + envName] = naclSource
          sources[STATE_SOURCE_PREFIX + envName] = mapReadOnlyElementsSource(state(envName), async element =>
            getElementHiddenParts(element, state(envName), await naclSource.get(element.elemID)),
          )
        })
        const initializedState = {
          states,
          mergeManager: await createMergeManager(
            [...Object.values(states).flatMap(remoteMaps => Object.values(remoteMaps))],
            sources,
            remoteMapCreator,
            'workspaceMergeManager',
            persistent,
            mergedRecoveryMode,
          ),
        }
        return initializedState
      }

      /** HERE BE DRAGONS!
       *
       * Dragon 1: `workspaceState` will be `undefined` until `buildWorkspaceState` returns a promise (see the code in
       * `getWorkspaceState`). `buildWorkspaceState` will return a promise the first time it executes an `await`.
       * This means you can't put an `await` between the start of `buildWorkspaceState` and the following lines.
       *
       * Dragon 2: initState() uses naclFilesSource. One can't use naclFilesSource until load() was called on it. Hence,
       * setting wsChanges must happen after we set previousState, but before we call initState().
       * Don't move the initialization of wsChanges.
       */
      const previousState = workspaceState

      const wsChanges =
        workspaceChanges !== undefined ? workspaceChanges : await naclFilesSource.load({ ignoreFileChanges })

      const stateToBuild = previousState !== undefined ? await previousState : await initState()

      const initBuild = previousState === undefined

      if (ignoreFileChanges) {
        // Skip all updates to the state since this flag means we are operating under the assumption
        // that everything is already up to date and no action is required
        return stateToBuild
      }

      const updateWorkspace = async (envName: string): Promise<void> => {
        const source = naclFilesSource

        // When we load the workspace with a clean cache from existings nacls, we need
        // to add hidden elements from the state since they will not be a part of the nacl
        // changes. In any other load - the state changes will be reflected by the workspace
        // / hidden changes.
        const completeStateOnlyChanges = async (
          partialStateChanges: ChangeSet<Change<Element>>,
        ): Promise<ChangeSet<Change<Element>>> => {
          const cachedHash = await stateToBuild.mergeManager.getHash(STATE_SOURCE_PREFIX + envName)
          const stateHash = await state(envName).getHash()
          const cacheValid = initBuild ? cachedHash === stateHash && partialStateChanges.cacheValid : true
          if (!cacheValid) {
            log.warn('Local state cache did not match local file system state. Resetting cache.')
            log.debug(`Cached hash: ${cachedHash}, stateHash: ${stateHash}.`)
          }
          // We identify a first nacl load when the state is empty, and all of the changes
          // are visible (which indicates a nacl load and not a first 'fetch' in which the
          // hidden changes won't be empty)
          const isFirstInitFromNacls =
            _.isEmpty(partialStateChanges.changes) && (await stateToBuild.states[envName].merged.isEmpty())
          const initHiddenElementsChanges = isFirstInitFromNacls
            ? await awu(await state(envName).getAll())
                .filter(element => isHidden(element, state(envName)))
                .map(elem => toChange({ after: elem }))
                .toArray()
            : []
          log.debug('got %d init hidden element changes', initHiddenElementsChanges.length)

          const stateRemovedElementChanges = await awu(wsChanges[envName]?.changes ?? [])
            .filter(
              async change =>
                isRemovalChange(change) &&
                getChangeData(change).elemID.isTopLevel() &&
                !(await isHidden(getChangeData(change), state(envName))),
            )
            .toArray()
          log.debug('got %d state removed element changes', stateRemovedElementChanges.length)

          // To preserve the old ws functionality - hidden values should be added to the workspace
          // cache only if their top level element is in the nacls, or they are marked as hidden
          // (SAAS-2639)
          const [stateChangesForExistingNaclElements, droppedStateOnlyChange] = await partition(
            partialStateChanges.changes,
            async change => {
              const changeData = getChangeData(change)
              const changeID = changeData.elemID
              return (
                isRemovalChange(change) ||
                (await (await source.getElementsSource(envName)).get(changeID)) ||
                isHidden(changeData, state(envName))
              )
            },
          )

          if (droppedStateOnlyChange.length > 0) {
            log.debug(
              'dropped hidden changes due to missing nacl element for ids: %s',
              droppedStateOnlyChange
                .map(getChangeData)
                .map(elem => elem.elemID.getFullName())
                .join(', '),
            )
          }

          return {
            changes: stateChangesForExistingNaclElements
              .concat(initHiddenElementsChanges)
              .concat(stateRemovedElementChanges),
            cacheValid,
            preChangeHash: partialStateChanges.preChangeHash ?? cachedHash,
            postChangeHash: stateHash,
          }
        }

        const dropStateOnlyElementsRecovery: RecoveryOverrideFunc = async (src1RecElements, src2RecElements, src2) => {
          const src1ElementsToMerge = await awu(src1RecElements).toArray()
          const src1IDSet = new Set(src1ElementsToMerge.map(elemID => elemID.getFullName()))

          const shouldIncludeStateElement = async (elemID: ElemID): Promise<boolean> =>
            src1IDSet.has(elemID.getFullName()) || isHidden(await src2.get(elemID), state(envName))

          const src2ElementsToMerge = awu(src2RecElements).filter(shouldIncludeStateElement)

          return {
            src1ElementsToMerge: awu(src1ElementsToMerge),
            src2ElementsToMerge,
          }
        }

        const changeResult = await stateToBuild.mergeManager.mergeComponents({
          src1Changes: wsChanges[envName],
          src2Changes: await completeStateOnlyChanges(
            stateOnlyChanges[envName] ?? createEmptyChangeSet(await state(envName).getHash()),
          ),
          recoveryOverride: dropStateOnlyElementsRecovery,
          src1Prefix: MULTI_ENV_SOURCE_PREFIX + envName,
          src2Prefix: STATE_SOURCE_PREFIX + envName,
          mergeFunc: elements => mergeElements(elements),
          currentElements: stateToBuild.states[envName].merged,
          currentErrors: stateToBuild.states[envName].errors,
        })
        if (!changeResult.cacheValid) {
          await stateToBuild.states[envName].validationErrors.clear()
        }
        const { changes } = changeResult
        await updateChangedByIndex(
          changes,
          stateToBuild.states[envName].changedBy,
          stateToBuild.states[envName].mapVersions,
          stateToBuild.states[envName].merged,
          changeResult.cacheValid,
        )

        await updateChangedAtIndex(
          changes,
          stateToBuild.states[envName].changedAt,
          stateToBuild.states[envName].mapVersions,
          stateToBuild.states[envName].merged,
          changeResult.cacheValid,
        )

        await updateAuthorInformationIndex(
          changes,
          stateToBuild.states[envName].authorInformation,
          stateToBuild.states[envName].mapVersions,
          stateToBuild.states[envName].merged,
          changeResult.cacheValid,
        )

        await updateAliasIndex(
          changes,
          stateToBuild.states[envName].alias,
          stateToBuild.states[envName].mapVersions,
          stateToBuild.states[envName].merged,
          changeResult.cacheValid,
        )

        await updateReferencedStaticFilesIndex(
          changes,
          stateToBuild.states[envName].referencedStaticFiles,
          stateToBuild.states[envName].mapVersions,
          stateToBuild.states[envName].merged,
          changeResult.cacheValid,
        )

        await updateReferenceIndexes(
          changes,
          stateToBuild.states[envName].referenceTargets,
          stateToBuild.states[envName].referenceSources,
          stateToBuild.states[envName].mapVersions,
          stateToBuild.states[envName].merged,
          changeResult.cacheValid,
          elements => getCustomReferences(elements, currentEnvConf().accountToServiceName ?? {}, adaptersConfig),
        )

        if (validate) {
          const changeIDs = changes.map(change => getChangeData(change).elemID)
          const changedElements: Element[] = changes.filter(isAdditionOrModificationChange).map(getChangeData)
          const dependents = await getDependents(
            changeIDs,
            stateToBuild.states[envName].merged,
            stateToBuild.states[envName].referenceSources,
          )

          const keysToDelete = changeIDs.concat(dependents.map(elem => elem.elemID)).map(id => id.getFullName())
          await stateToBuild.states[envName].validationErrors.deleteAll(keysToDelete)

          const elementsToValidate = changedElements.concat(dependents)
          const errors = await validateElements(elementsToValidate, stateToBuild.states[envName].merged)
          await stateToBuild.states[envName].validationErrors.setAll(errors)
        }
      }

      await awu(envs()).forEach(async envName => {
        await updateWorkspace(envName)
      })
      return stateToBuild
    }, 'buildWorkspaceState')

  const getWorkspaceState = async (): Promise<WorkspaceState> => {
    if (workspaceState === undefined) {
      workspaceState = buildWorkspaceState({})
    }
    return workspaceState
  }

  const updateWorkspaceState = async (...args: Parameters<typeof buildWorkspaceState>): Promise<void> => {
    workspaceState = buildWorkspaceState(...args)
    await workspaceState
  }

  const getLoadedNaclFilesSource = async (): Promise<MultiEnvSource> => {
    // We load the nacl file source, and make sure the state of the WS is also
    // updated. (Without this - the load changes will be lost)
    await getWorkspaceState()
    return naclFilesSource
  }

  const elements = async (env?: string): Promise<ElementsSource> =>
    (await getWorkspaceState()).states[env ?? currentEnv()].merged

  const getStateOnlyChanges = async (hiddenChanges: DetailedChange[]): Promise<Change[]> => {
    const changesByID = _.groupBy(hiddenChanges, change => change.id.createTopLevelParentID().parent.getFullName())

    return awu(Object.values(changesByID))
      .flatMap(async changes => {
        const refID = changes[0].id
        if (refID.isTopLevel()) {
          return changes
        }
        const before = await state().get(refID.createTopLevelParentID().parent)
        if (before === undefined) {
          return []
        }
        const clonedBefore = before.clone()
        applyDetailedChanges(clonedBefore, changes)
        const after = await getElementHiddenParts(clonedBefore, state(), before)
        return [toChange({ before, after })]
      })
      .toArray()
  }

  const fixStateOnlyChangesFieldTypes = (stateOnlyChanges: Change[], changes: DetailedChange[]): void => {
    // stateOnlyChanges should contain only the hidden parts from the state. for fields it is not
    // possible to hide just the type of the field, so in theory the type of the field shouldn't
    // be a part of the information (since the type is not hidden unless the whole field is hidden),
    // but since we can't have a field without a type, we have to put something there. using the type
    // from the original change to make sure there is no conflict is a way to "remove" the information.
    const modifiedFieldsByParent = _.groupBy(
      changes.filter(isModificationChange).map(getChangeData).filter(isField),
      field => field.parent.elemID.getFullName(),
    )
    stateOnlyChanges
      .filter(isModificationChange)
      .map(getChangeData)
      .filter(isObjectType)
      .forEach(element => {
        const modifiedFields = modifiedFieldsByParent[element.elemID.getFullName()] ?? []
        modifiedFields
          .filter(field => element.fields[field.name] !== undefined)
          .forEach(field => {
            element.fields[field.name].refType = new TypeReference(field.refType.elemID)
          })
      })
  }

  const updateNaclFiles = async ({
    changes,
    mode,
    stateOnly = false,
    validate = true,
  }: {
    changes: DetailedChangeWithBaseChange[]
    mode?: RoutingMode
    validate?: boolean
    stateOnly?: boolean
  }): Promise<UpdateNaclFilesResult> => {
    const { visible: visibleChanges, hidden: hiddenChanges } = await handleHiddenChanges(
      changes,
      state(),
      await (await getLoadedNaclFilesSource()).getElementsSource(currentEnv()),
    )
    const workspaceChanges = await (
      await getLoadedNaclFilesSource()
    ).updateNaclFiles(currentEnv(), stateOnly ? [] : visibleChanges, mode)
    const currentStateHash = workspaceState
      ? await (await workspaceState).mergeManager.getHash(STATE_SOURCE_PREFIX + currentEnv())
      : undefined
    const loadedStateHash = await state(currentEnv()).getHash()
    await state(currentEnv()).calculateHash()
    const postChangeHash = await state(currentEnv()).getHash()
    const stateOnlyChanges = await getStateOnlyChanges(hiddenChanges)
    fixStateOnlyChangesFieldTypes(stateOnlyChanges, changes)
    await updateWorkspaceState({
      workspaceChanges,
      stateOnlyChanges: {
        [currentEnv()]: {
          changes: stateOnlyChanges,
          cacheValid: currentStateHash === loadedStateHash,
          preChangeHash: currentStateHash,
          postChangeHash,
        },
      },
      validate,
    })
    return {
      naclFilesChangesCount: Object.values(workspaceChanges)
        .map(changeSet => changeSet.changes)
        .flat().length,
      stateOnlyChangesCount: stateOnlyChanges.length,
    }
  }
  const setNaclFiles = async (naclFiles: NaclFile[], validate = true): Promise<EnvsChanges> => {
    const [configFiles, otherFiles] = _.partition(naclFiles, file => adaptersConfig.isConfigFile(file.filename))

    if (configFiles.length !== 0) {
      await adaptersConfig.setNaclFiles(configFiles)
    }

    if (otherFiles.length !== 0) {
      const elementChanges = await (await getLoadedNaclFilesSource()).setNaclFiles(otherFiles)
      await updateWorkspaceState({ workspaceChanges: elementChanges, validate })
      return elementChanges
    }

    return {}
  }

  const removeNaclFiles = async (names: string[], validate = true): Promise<EnvsChanges> => {
    const elementChanges = await (await getLoadedNaclFilesSource()).removeNaclFiles(names)
    await updateWorkspaceState({ workspaceChanges: elementChanges, validate })
    return elementChanges
  }

  const getErrorSourceRange = async <T extends SaltoElementError>(error: T): Promise<parser.SourceRange[]> =>
    error.type === 'config'
      ? adaptersConfig.getSourceRanges(error.elemID)
      : (await getLoadedNaclFilesSource()).getSourceRanges(currentEnv(), error.elemID)

  const transformParseError = (error: parser.ParseError): WorkspaceError<SaltoError> => ({
    ...error,
    sourceLocations: [{ sourceRange: error.context, subRange: error.subject }],
  })

  const transformToWorkspaceError = async <T extends SaltoElementError>(
    saltoElemErr: T,
  ): Promise<Readonly<WorkspaceError<T>>> => {
    const sourceRanges = await getErrorSourceRange(saltoElemErr)
    const sourceLocations: SourceLocation[] = sourceRanges.map(sourceRange => ({ sourceRange }))

    return {
      ...saltoElemErr,
      message: saltoElemErr.message,
      detailedMessage: saltoElemErr.detailedMessage,
      sourceLocations,
    }
  }
  const transformError = async (error: SaltoError): Promise<WorkspaceError<SaltoError>> => {
    const isParseError = (err: SaltoError): err is parser.ParseError => _.has(err, 'subject')
    const isElementError = (err: SaltoError): err is SaltoElementError => _.get(err, 'elemID') instanceof ElemID
    if (isParseError(error)) {
      return transformParseError(error)
    }
    if (isElementError(error)) {
      return transformToWorkspaceError(error)
    }
    return { ...error, sourceLocations: [] }
  }

  const errors = async (env?: string): Promise<Errors> => {
    const envToUse = env ?? currentEnv()
    const currentWorkspaceState = await getWorkspaceState()
    const loadNaclFileSource = await getLoadedNaclFilesSource()
    // It is important to make sure these are obtain using Promise.all in order to allow
    // the SaaS UI to debounce the DB accesses.
    const [errorsFromSource, configErrors, validationErrors, mergeErrors]: [
      Errors,
      Errors,
      ValidationError[],
      MergeError[],
    ] = await Promise.all([
      loadNaclFileSource.getErrors(env ?? currentEnv()),
      adaptersConfig.getErrors(),
      awu(currentWorkspaceState.states[envToUse].validationErrors.values()).flat().toArray(),
      awu(currentWorkspaceState.states[envToUse].errors.values()).flat().toArray(),
    ])

    logValidationErrors(validationErrors, 'elements')
    logValidationErrors(configErrors.validation, 'config')

    return new Errors({
      parse: [...errorsFromSource.parse, ...configErrors.parse],
      merge: [...errorsFromSource.merge, ...mergeErrors, ...configErrors.merge],
      validation: [...validationErrors, ...configErrors.validation],
    })
  }
  const elementsImpl = async (includeHidden = true, env?: string): Promise<ElementsSource> => {
    if (includeHidden) {
      return elements(env)
    }
    await getWorkspaceState()
    return (await getLoadedNaclFilesSource()).getElementsSource(env ?? currentEnv())
  }

  const getSourceByFilename = async (filename: string): Promise<AdaptersConfigSource | MultiEnvSource> =>
    adaptersConfig.isConfigFile(filename) ? adaptersConfig : getLoadedNaclFilesSource()

  const pickAccounts = (names?: ReadonlyArray<string>): ReadonlyArray<string> =>
    _.isUndefined(names) ? accounts() : accounts().filter(s => names.includes(s))
  const credsPath = (account: string): string => path.join(currentEnv(), account)
  const copyTo = async (ids: ElemID[], targetEnvs: string[]): Promise<void> => {
    const workspaceChanges = await (await getLoadedNaclFilesSource()).copyTo(currentEnv(), ids, targetEnvs)
    await updateWorkspaceState({ workspaceChanges })
  }

  const accountCredentials = async (
    names?: ReadonlyArray<string>,
  ): Promise<Readonly<Record<string, InstanceElement>>> =>
    _.fromPairs(
      await Promise.all(pickAccounts(names).map(async account => [account, await credentials.get(credsPath(account))])),
    )
  const addAccount = async (service: string, account?: string): Promise<void> => {
    const accountName = account ?? service

    if (!isValidAccountName(accountName)) {
      throw new InvalidAccountNameError(accountName)
    }
    const currentAccounts = accounts() || []
    if (currentAccounts.includes(accountName)) {
      throw new AccountDuplicationError(accountName)
    }
    const envConf = currentEnvConf()
    if (!envConf.accountToServiceName) {
      envConf.accountToServiceName = {}
    }
    envConf.accountToServiceName[accountName] = service
    await config.setWorkspaceConfig(workspaceConfig)
  }
  const hasElementsInAccounts = async (accountNames: string[]): Promise<boolean> => {
    const source = await (await getLoadedNaclFilesSource()).getElementsSource(currentEnv())
    return awu(await source.list()).some(elemId => accountNames.includes(elemId.adapter))
  }
  const updateAccountCredentials = async (
    account: string,
    credentialElements: Readonly<InstanceElement>,
  ): Promise<void> => credentials.set(credsPath(account), credentialElements)
  const updateAccountConfig = async (
    service: string,
    newConfig: Readonly<InstanceElement> | Readonly<InstanceElement>[],
    account?: string,
  ): Promise<void> => {
    await adaptersConfig.setAdapter(account ?? service, service, newConfig)
  }
  const getAllChangedByAuthors = async (envName?: string): Promise<Author[]> => {
    const env = envName ?? currentEnv()
    const currentWorkspaceState = await getWorkspaceState()
    const keys = await awu(currentWorkspaceState.states[env].changedBy.keys()).toArray()
    return keys.map(authorKeyToAuthor)
  }

  const getChangedElementsByAuthors = async (authors: Author[], envName?: string): Promise<ElemID[]> => {
    const env = envName ?? currentEnv()
    const currentWorkspaceState = await getWorkspaceState()
    const result = (await currentWorkspaceState.states[env].changedBy.getMany(authors.map(authorToAuthorKey))) ?? []
    return result.filter(values.isDefined).flat()
  }
  const getChangedElementsBetween = async (dateRange: DateRange, envName?: string): Promise<ElemID[]> => {
    const isDateInRange = (date: string): boolean => {
      const dateToCheck = new Date(date)
      return dateToCheck >= dateRange.start && (dateRange.end === undefined || dateToCheck <= dateRange.end)
    }
    const env = envName ?? currentEnv()
    const currentWorkspaceState = await getWorkspaceState()
    const relevantTimestamps = await awu(currentWorkspaceState.states[env].changedAt.keys())
      .filter(isDateInRange)
      .toArray()
    const result = await currentWorkspaceState.states[env].changedAt.getMany(relevantTimestamps)
    return result.filter(values.isDefined).flat()
  }
  const getStaticFilePathsByElemIds = async (elementIds: ElemID[], envName?: string): Promise<string[]> => {
    const env = envName ?? currentEnv()
    const currentWorkspaceState = await getWorkspaceState()
    const result = await currentWorkspaceState.states[env].referencedStaticFiles.getMany(
      elementIds.map(elemId => elemId.getFullName()),
    )
    return result.filter(values.isDefined).flat()
  }
  const getElemIdsByStaticFilePaths = async (
    filePaths?: Set<string>,
    envName?: string,
  ): Promise<Record<string, string>> => {
    const env = envName ?? currentEnv()
    const currentWorkspaceState = await getWorkspaceState()
    return Object.fromEntries(
      await awu(currentWorkspaceState.states[env].referencedStaticFiles.entries())
        .flatMap(({ key: id, value: fileNames }) =>
          fileNames
            .filter(filename => filePaths === undefined || filePaths.has(filename))
            .map(filename => [filename, id]),
        )
        .toArray(),
    )
  }
  const getAliases = async (envName?: string): Promise<ReadOnlyRemoteMap<string>> => {
    const env = envName ?? currentEnv()
    const currentWorkspaceState = await getWorkspaceState()
    return currentWorkspaceState.states[env].alias
  }

  const isChangedAtIndexEmpty = async (envName?: string): Promise<boolean> => {
    const env = envName ?? currentEnv()
    const currentWorkspaceState = await getWorkspaceState()
    return currentWorkspaceState.states[env].changedBy.isEmpty()
  }

  const getElementIncomingReferenceInfos: Workspace['getElementIncomingReferenceInfos'] = async (
    id,
    envName = currentEnv(),
  ) => {
    if (!id.isBaseID()) {
      throw new Error(`getElementIncomingReferenceInfos only support base ids, received ${id.getFullName()}`)
    }
    const entries = makeArray(await (await getWorkspaceState()).states[envName].referenceSources.get(id.getFullName()))
    return entries.map(toReferenceIndexEntryWithDefaults)
  }

  const workspace: Workspace = {
    uid: workspaceConfig.uid,
    elements: elementsImpl,
    state,
    close: async () => {
      if (workspaceState !== undefined) {
        // in case that `workspaceState` is currently being built, we'd like to wait until it finishes.
        log.debug('waiting for workspaceState to finish building before closing the workspace')
        try {
          await workspaceState
        } catch (error) {
          log.warn('failed waiting for workspaceState to finish building with error: %o', error)
        }
      }
      log.debug('closing the workspace')
      await remoteMapCreator.close()
    },
    envs,
    currentEnv,
    accounts,
    services: accounts,
    errors,
    hasErrors: async (env?: string) => (await errors(env)).hasErrors(),
    accountCredentials,
    servicesCredentials: accountCredentials,
    accountConfig: async (name, defaultValue, shouldResolve) => {
      const unresolvedAccountConfig = await adaptersConfig.getAdapter(name, defaultValue)
      if (!unresolvedAccountConfig) {
        log.error('Failed to get accountConfig, received undefined')
        return undefined
      }
      if (!shouldResolve) {
        return unresolvedAccountConfig
      }
      const resolvedAccountConfig = (await resolve([unresolvedAccountConfig], adaptersConfig.getElements()))[0]
      if (!isInstanceElement(resolvedAccountConfig)) {
        log.error('Failed to resolve accountConfig, expected InstanceElement')
        return undefined
      }
      return resolvedAccountConfig
    },
    serviceConfig: (name, defaultValue) => adaptersConfig.getAdapter(name, defaultValue),
    accountConfigPaths: adaptersConfig.getElementNaclFiles,
    serviceConfigPaths: adaptersConfig.getElementNaclFiles,
    isEmpty: async (naclFilesOnly = false): Promise<boolean> => {
      const isNaclFilesSourceEmpty = await (await getLoadedNaclFilesSource()).isEmpty(currentEnv())
      return isNaclFilesSourceEmpty && (naclFilesOnly || state().isEmpty())
    },
    hasElementsInAccounts,
    hasElementsInServices: hasElementsInAccounts,
    hasElementsInEnv: async envName => {
      const envSource = environmentsSources.sources[envName]
      if (envSource === undefined) {
        return false
      }
      return !(await envSource.naclFiles.isEmpty())
    },
    envOfFile: filename => getSourceNameForFilename(filename, envs() as string[], environmentsSources.commonSourceName),
    // Returning the functions from the nacl file source directly (eg: promote: src.promote)
    // may seem better, but the setCurrentEnv method replaced the naclFileSource.
    // Passing direct pointer for these functions would have resulted in pointers to a nullified
    // source so we need to wrap all of the function calls to make sure we are forwarding the method
    // invocations to the proper source.
    setNaclFiles,
    updateNaclFiles: (changes, mode, stateOnly) => updateNaclFiles({ changes, mode, stateOnly }),
    removeNaclFiles,
    getSourceMap: async (filename: string) => (await getSourceByFilename(filename)).getSourceMap(filename),
    getSourceRanges: async (elemID: ElemID) => (await getLoadedNaclFilesSource()).getSourceRanges(currentEnv(), elemID),
    listNaclFiles: async () => [
      ...(await (await getLoadedNaclFilesSource()).listNaclFiles(currentEnv())),
      ...(await adaptersConfig.listNaclFiles()),
    ],
    getElementIdsBySelectors: async (selectors: ElementSelector[], from, compacted = false) => {
      const env = isFromSourceWithEnv(from) ? from.envName ?? currentEnv() : currentEnv()

      return (await getLoadedNaclFilesSource()).getElementIdsBySelectors(
        env,
        selectors,
        (await getWorkspaceState()).states[env].referenceSources,
        from.source,
        compacted,
      )
    },
    getReferenceSourcesIndex: async (envName = currentEnv()) =>
      (await getWorkspaceState()).states[envName].referenceSources,
    getElementOutgoingReferences: async (id, envName = currentEnv(), includeWeakReferences = true) => {
      const baseId = id.createBaseID().parent.getFullName()
      const referencesTree = await (await getWorkspaceState()).states[envName].referenceTargets.get(baseId)

      if (referencesTree === undefined) {
        return []
      }

      const idPath = id.createBaseID().path.join(ElemID.NAMESPACE_SEPARATOR)
      const references = Array.from(
        idPath === ''
          ? // Empty idPath means we are requesting the base level element, which includes all references
            referencesTree.values()
          : referencesTree.valuesWithPrefix(idPath),
      ).flat()

      const filteredReferences = includeWeakReferences ? references : references.filter(ref => ref.type !== 'weak')
      return _.uniqBy(filteredReferences, ref => ref.id.getFullName()).map(toReferenceIndexEntryWithDefaults)
    },
    getElementIncomingReferences: async (id, envName = currentEnv()) => {
      const referenceInfos = await getElementIncomingReferenceInfos(id, envName)
      return referenceInfos.map(entry => entry.id)
    },
    getElementIncomingReferenceInfos,
    getElementAuthorInformation: async (id, envName = currentEnv()) => {
      if (!id.isBaseID()) {
        throw new Error(`getElementAuthorInformation only support base ids, received ${id.getFullName()}`)
      }
      return (await (await getWorkspaceState()).states[envName].authorInformation.get(id.getFullName())) ?? {}
    },
    getElementsAuthorsById: async (envName = currentEnv()) => {
      const authorInformationMap = (await getWorkspaceState()).states[envName].authorInformation
      const entries = await awu(authorInformationMap.entries()).toArray()
      return Object.fromEntries(entries.map(entry => [entry.key, entry.value]))
    },
    getAllChangedByAuthors,
    getChangedElementsByAuthors,
    getElementNaclFiles: async id => (await getLoadedNaclFilesSource()).getElementNaclFiles(currentEnv(), id),
    getElementFileNames: async (env?: string): Promise<Map<string, string[]>> =>
      (await getLoadedNaclFilesSource()).getElementFileNames(env ?? currentEnv()),
    getTotalSize: async () => (await getLoadedNaclFilesSource()).getTotalSize(),
    getNaclFile: async (filename: string) => (await getSourceByFilename(filename)).getNaclFile(filename),
    getParsedNaclFile: async (filename: string) => (await getSourceByFilename(filename)).getParsedNaclFile(filename),
    promote: async (idsToMove, idsToRemove) => {
      const workspaceChanges = await (await getLoadedNaclFilesSource()).promote(currentEnv(), idsToMove, idsToRemove)
      await updateWorkspaceState({ workspaceChanges })
    },
    demote: async (ids: ElemID[]) => {
      const workspaceChanges = await (await getLoadedNaclFilesSource()).demote(ids)
      await updateWorkspaceState({ workspaceChanges })
    },
    demoteAll: async () => {
      const workspaceChanges = await (await getLoadedNaclFilesSource()).demoteAll()
      await updateWorkspaceState({ workspaceChanges })
    },
    copyTo,
    sync: async (idsToCopy, idsToRemove, targetEnvs) => {
      const workspaceChanges = await (
        await getLoadedNaclFilesSource()
      ).sync(currentEnv(), idsToCopy, idsToRemove, targetEnvs)
      await updateWorkspaceState({ workspaceChanges })
    },
    transformToWorkspaceError,
    transformError,
    flush: async (): Promise<void> => {
      if (!persistent) {
        throw new Error('Can not flush a non-persistent workspace.')
      }
      // Must call getWorkspaceState first to make sure everything is loaded before flushing
      const currentWSState = await getWorkspaceState()
      await currentWSState.mergeManager.flush()
      await (await getLoadedNaclFilesSource()).flush()
      await adaptersConfig.flush()
      await awu(Object.values(environmentsSources.sources)).forEach(envSource => envSource.state?.flush())
    },
    clone: (): Promise<Workspace> => {
      const sources = _.mapValues(environmentsSources.sources, source => ({
        naclFiles: source.naclFiles.clone(),
        state: source.state,
      }))
      const envSources = { commonSourceName: environmentsSources.commonSourceName, sources }
      return loadWorkspace({
        config,
        adaptersConfig,
        credentials,
        environmentsSources: envSources,
        remoteMapCreator,
        ignoreFileChanges,
        persistent,
        mergedRecoveryMode,
        adapterCreators,
      })
    },
    clear: async (args: ClearFlags) => {
      const currentWSState = await getWorkspaceState()
      if (args.cache || args.nacl || args.staticResources) {
        if (args.staticResources && !(args.state && args.cache && args.nacl)) {
          throw new Error('Cannot clear static resources without clearing the state, cache and nacls')
        }
        await currentWSState.mergeManager.clear()
        // We shouldn't really be accessing naclFilesSource directly outside of its
        // init flow, but in this specific case, there is not point in loading anything
        // since everything is deleted.
        await naclFilesSource.clear(args)
      }
      if (args.state) {
        await promises.array.series(envs().map(e => () => state(e).clear()))
      }
      if (args.credentials) {
        await promises.array.series(envs().map(e => () => credentials.delete(e)))
      }
      workspaceState = undefined
      await getWorkspaceState()
    },
    addAccount,
    addService: addAccount,
    updateAccountCredentials,
    updateServiceCredentials: updateAccountCredentials,
    updateAccountConfig,
    updateServiceConfig: updateAccountConfig,
    getServiceFromAccountName: (account: string): string => {
      const mapping = currentEnvConf().accountToServiceName
      if (mapping === undefined) {
        throw new UnknownAccountError(account)
      }
      const serviceName = mapping[account]
      if (serviceName === undefined) {
        throw new UnknownAccountError(account)
      }
      return serviceName
    },
    addEnvironment: async (
      env: string,
      environmentSourceCreator: (rmc: RemoteMapCreator) => Promise<EnvironmentSource>,
    ): Promise<void> => {
      if (workspaceConfig.envs.map(e => e.name).includes(env)) {
        throw new EnvDuplicationError(env)
      }
      if (!isValidEnvName(env)) {
        throw new InvalidEnvNameError(env)
      }
      // Need to make sure everything is loaded before we add the new env.
      await getWorkspaceState()
      workspaceConfig.envs = [...workspaceConfig.envs, { name: env, accountToServiceName: {} }]
      await config.setWorkspaceConfig(workspaceConfig)
      environmentsSources.sources[env] = await environmentSourceCreator(remoteMapCreator)
      naclFilesSource = multiEnvSource(
        _.mapValues(environmentsSources.sources, e => e.naclFiles),
        environmentsSources.commonSourceName,
        remoteMapCreator,
        persistent,
        mergedRecoveryMode,
      )
      workspaceState = undefined
    },
    deleteEnvironment: async (env: string, keepNacls = false): Promise<void> => {
      if (!workspaceConfig.envs.map(e => e.name).includes(env)) {
        throw new UnknownEnvError(env)
      }
      if (env === currentEnv()) {
        throw new DeleteCurrentEnvError(env)
      }
      workspaceConfig.envs = workspaceConfig.envs.filter(e => e.name !== env)
      await config.setWorkspaceConfig(workspaceConfig)

      // We assume here that all the credentials files sit under the credentials' env directory
      await credentials.delete(env)

      if (!keepNacls) {
        const environmentSource = environmentsSources.sources[env]
        // ensure that the env is loaded
        await environmentSource.naclFiles.load({})
        if (environmentSource) {
          await environmentSource.naclFiles.clear()
          await environmentSource.state?.clear()
        }
      }
      delete environmentsSources.sources[env]
      naclFilesSource = multiEnvSource(
        _.mapValues(environmentsSources.sources, e => e.naclFiles),
        environmentsSources.commonSourceName,
        remoteMapCreator,
        persistent,
        mergedRecoveryMode,
      )
    },
    renameEnvironment: async (envName: string, newEnvName: string, newEnvNaclPath?: string) => {
      const envConfig = envs().find(e => e === envName)
      if (_.isUndefined(envConfig)) {
        throw new UnknownEnvError(envName)
      }
      if (!isValidEnvName(newEnvName)) {
        throw new InvalidEnvNameError(newEnvName)
      }

      if (!_.isUndefined(envs().find(e => e === newEnvName))) {
        throw new EnvDuplicationError(newEnvName)
      }

      currentEnvsConf()
        .filter(e => e.name === envName)
        .forEach(e => {
          e.name = newEnvName
        })
      if (envName === workspaceConfig.currentEnv) {
        workspaceConfig.currentEnv = newEnvName
      }
      await config.setWorkspaceConfig(workspaceConfig)
      await credentials.rename(envName, newEnvName)

      const environmentSource = environmentsSources.sources[envName]
      if (environmentSource) {
        // ensure that the env is loaded
        await environmentSource.naclFiles.load({})
        await environmentSource.naclFiles.rename(newEnvNaclPath || newEnvName)
        await environmentSource.state?.rename(newEnvName)
      }
      environmentsSources.sources[newEnvName] = environmentSource
      delete environmentsSources.sources[envName]
      naclFilesSource = multiEnvSource(
        _.mapValues(environmentsSources.sources, e => e.naclFiles),
        environmentsSources.commonSourceName,
        remoteMapCreator,
        persistent,
        mergedRecoveryMode,
      )
    },
    setCurrentEnv: async (env: string, persist = true): Promise<void> => {
      if (!envs().includes(env)) {
        throw new UnknownEnvError(env)
      }

      if (persist) {
        workspaceConfig.currentEnv = env
        await config.setWorkspaceConfig(workspaceConfig)
      } else {
        overrideEnv = env
      }
    },

    updateStateProvider: async stateConfig => {
      if (_.isEqual(workspaceConfig.state, stateConfig)) {
        // The config did not change, nothing to do
        return
      }
      log.debug('Changing state config from %s to %s', inspectValue(workspaceConfig.state), inspectValue(stateConfig))
      await Promise.all(
        Object.values(environmentsSources.sources)
          .map(source => source.state)
          .filter(values.isDefined)
          .map(sourceState => sourceState.updateConfig({ workspaceId: workspaceConfig.uid, stateConfig })),
      )
      workspaceConfig.state = stateConfig
      await config.setWorkspaceConfig(workspaceConfig)
    },
    getValue: async (id: ElemID, env?: string): Promise<Value | undefined> => (await elements(env)).get(id),
    getSearchableNames: async (): Promise<string[]> =>
      (await getLoadedNaclFilesSource()).getSearchableNames(currentEnv()),
    getSearchableNamesOfEnv: async (env?: string): Promise<string[]> =>
      (await getLoadedNaclFilesSource()).getSearchableNamesOfEnv(env ?? currentEnv()),
    listUnresolvedReferences: async (completeFromEnv?: string): Promise<UnresolvedElemIDs> => {
      const getUnresolvedElemIDsFromErrors = (validationErrors: readonly ValidationError[]): ElemID[] => {
        const workspaceErrors = validationErrors.filter(isUnresolvedRefError).map(e => e.target.createBaseID().parent)
        return _.uniqBy(workspaceErrors, elemID => elemID.getFullName())
      }
      const unresolvedElemIDs = getUnresolvedElemIDsFromErrors((await errors()).validation)
      if (completeFromEnv === undefined) {
        return {
          found: [],
          missing: compact(_.sortBy(unresolvedElemIDs, id => id.getFullName())),
        }
      }

      const { dependencies, missing } = await listElementsDependenciesInWorkspace({
        workspace,
        elemIDsToFind: unresolvedElemIDs,
        elemIDsToSkip: (await workspace.getSearchableNames()).map(ElemID.fromFullName),
        envToListFrom: completeFromEnv,
      })
      const completedElemIds = _.uniq(
        Object.values(dependencies)
          .flat()
          .map(elemId => elemId.getFullName())
          .concat(Object.keys(dependencies)),
      )
      return {
        found: compact(completedElemIds.sort().map(ElemID.fromFullName)),
        missing: compact(_.sortBy(missing, id => id.getFullName())),
      }
    },
    getElementSourceOfPath: async (filePath, includeHidden = true) =>
      adaptersConfig.isConfigFile(filePath) ? adaptersConfig.getElements() : elementsImpl(includeHidden),
    getFileEnvs: filePath => naclFilesSource.getFileEnvs(filePath),
    getStaticFile: async ({ filepath, encoding, env, isTemplate, hash }) =>
      naclFilesSource.getStaticFile({ filePath: filepath, encoding, env: env ?? currentEnv(), isTemplate, hash }),
    getChangedElementsBetween,
    getStaticFilePathsByElemIds,
    getElemIdsByStaticFilePaths,
    getAliases,
    isChangedAtIndexEmpty,
  }
  return workspace
}

type InitWorkspaceParams = {
  uid: string
  defaultEnvName: string
  config: WorkspaceConfigSource
  adaptersConfig: AdaptersConfigSource
  credentials: ConfigSource
  environmentSources: EnvironmentsSources
  remoteMapCreator: RemoteMapCreator
  adapterCreators: Record<string, Adapter>
}

export async function initWorkspace({
  uid,
  defaultEnvName,
  config,
  adaptersConfig,
  credentials,
  environmentSources,
  remoteMapCreator,
  adapterCreators,
}: InitWorkspaceParams): Promise<Workspace> {
  log.debug('Initializing workspace with id: %s', uid)
  await config.setWorkspaceConfig({
    uid,
    envs: [{ name: defaultEnvName, accountToServiceName: {} }],
    currentEnv: defaultEnvName,
  })
  return loadWorkspace({
    config,
    adaptersConfig,
    credentials,
    environmentsSources: environmentSources,
    remoteMapCreator,
    adapterCreators,
  })
}
