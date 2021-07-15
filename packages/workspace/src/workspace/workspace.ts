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
import _ from 'lodash'
import path from 'path'
import { Element, SaltoError, SaltoElementError, ElemID, InstanceElement, DetailedChange, Change,
  Value, toChange, isRemovalChange, getChangeElement, ReadOnlyElementsSource,
  isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { applyDetailedChanges } from '@salto-io/adapter-utils'
import { collections, promises, values } from '@salto-io/lowerdash'
import { ValidationError, validateElements } from '../validator'
import { SourceRange, ParseError, SourceMap } from '../parser'
import { ConfigSource } from './config_source'
import { State } from './state'
import { multiEnvSource, getSourceNameForFilename, MultiEnvSource, EnvsChanges } from './nacl_files/multi_env/multi_env_source'
import { NaclFilesSource, NaclFile, RoutingMode } from './nacl_files/nacl_files_source'
import { ParsedNaclFile } from './nacl_files/parsed_nacl_file'
import { ElementSelector } from './element_selector'
import { Errors, ServiceDuplicationError, EnvDuplicationError, UnknownEnvError, DeleteCurrentEnvError } from './errors'
import { EnvConfig } from './config/workspace_config_types'
import { handleHiddenChanges, getElementHiddenParts, isHidden } from './hidden_values'
import { WorkspaceConfigSource } from './workspace_config_source'
import { MergeError, mergeElements } from '../merger'
import { RemoteElementSource, ElementsSource, mapReadOnlyElementsSource } from './elements_source'
import { createMergeManager, ElementMergeManager, ChangeSet, createEmptyChangeSet, MergedRecoveryMode } from './nacl_files/elements_cache'
import { RemoteMap, RemoteMapCreator } from './remote_map'
import { serialize, deserializeMergeErrors, deserializeSingleElement, deserializeValidationErrors } from '../serializer/elements'

const log = logger(module)

const { makeArray } = collections.array
const { awu } = collections.asynciterable

export const ADAPTERS_CONFIGS_PATH = 'adapters'
export const COMMON_ENV_PREFIX = ''
const DEFAULT_STALE_STATE_THRESHOLD_MINUTES = 60 * 24 * 7 // 7 days
const MULTI_ENV_SOURCE_PREFIX = 'multi_env_element_source'
const STATE_SOURCE_PREFIX = 'state_element_source'

export type SourceFragment = {
  sourceRange: SourceRange
  fragment: string
  subRange?: SourceRange
}

export type WorkspaceError<T extends SaltoError> = Readonly<T & {
  sourceFragments: SourceFragment[]
}>

type RecencyStatus = 'Old' | 'Nonexistent' | 'Valid'
export type StateRecency = {
  serviceName: string
  status: RecencyStatus
  date: Date | undefined
}

export type WorkspaceComponents = {
  nacl: boolean
  state: boolean
  cache: boolean
  staticResources: boolean
  credentials: boolean
  serviceConfig: boolean
}

export type ClearFlags = Omit<WorkspaceComponents, 'serviceConfig'>

export type Workspace = {
  uid: string
  name: string

  elements: (includeHidden?: boolean, env?: string) => Promise<ElementsSource>
  state: (envName?: string) => State
  envs: () => ReadonlyArray<string>
  currentEnv: () => string
  services: () => string[]
  servicesCredentials: (names?: ReadonlyArray<string>) =>
    Promise<Readonly<Record<string, InstanceElement>>>
  serviceConfig: (name: string, defaultValue?: InstanceElement) =>
    Promise<InstanceElement | undefined>

  isEmpty(naclFilesOnly?: boolean): Promise<boolean>
  hasElementsInServices(serviceNames: string[]): Promise<boolean>
  hasElementsInEnv(envName: string): Promise<boolean>
  envOfFile(filename: string): string
  getSourceFragment(sourceRange: SourceRange): Promise<SourceFragment>
  hasErrors(): Promise<boolean>
  errors(): Promise<Readonly<Errors>>
  transformToWorkspaceError<T extends SaltoElementError>(saltoElemErr: T):
    Promise<Readonly<WorkspaceError<T>>>
  transformError: (error: SaltoError) => Promise<WorkspaceError<SaltoError>>
  updateNaclFiles: (
    changes: DetailedChange[],
    mode?: RoutingMode,
    stateOnly? : boolean
  ) => Promise<number>
  listNaclFiles: () => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  setNaclFiles: (naclFiles: NaclFile[], validate?: boolean) => Promise<EnvsChanges>
  removeNaclFiles: (names: string[], validate?: boolean) => Promise<EnvsChanges>
  getSourceMap: (filename: string) => Promise<SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<SourceRange[]>
  getElementReferencedFiles: (id: ElemID) => Promise<string[]>
  getElementNaclFiles: (id: ElemID) => Promise<string[]>
  getElementIdsBySelectors: (
    selectors: ElementSelector[],
    commonOnly?: boolean,
    compact?: boolean,
  ) => Promise<AsyncIterable<ElemID>>
  getParsedNaclFile: (filename: string) => Promise<ParsedNaclFile | undefined>
  flush: () => Promise<void>
  clone: () => Promise<Workspace>
  clear: (args: ClearFlags) => Promise<void>

  addService: (service: string) => Promise<void>
  addEnvironment: (env: string) => Promise<void>
  deleteEnvironment: (env: string) => Promise<void>
  renameEnvironment: (envName: string, newEnvName: string, newSourceName? : string) => Promise<void>
  setCurrentEnv: (env: string, persist?: boolean) => Promise<void>
  updateServiceCredentials: (service: string, creds: Readonly<InstanceElement>) => Promise<void>
  updateServiceConfig: (service: string, newConfig: Readonly<InstanceElement>) => Promise<void>

  getStateRecency(services: string): Promise<StateRecency>
  promote(ids: ElemID[]): Promise<void>
  demote(ids: ElemID[]): Promise<void>
  demoteAll(): Promise<void>
  copyTo(ids: ElemID[], targetEnvs?: string[]): Promise<void>
  getValue(id: ElemID): Promise<Value | undefined>
  getSearchableNames(): Promise<string[]>
  getSearchableNamesOfEnv(env?: string): Promise<string[]>
}

// common source has no state
export type EnvironmentSource = { naclFiles: NaclFilesSource; state?: State }
export type EnvironmentsSources = {
  commonSourceName: string
  sources: Record<string, EnvironmentSource>
}

type SingleState = {
  merged: ElementsSource
  errors: RemoteMap<MergeError[]>
  validationErrors: RemoteMap<ValidationError[]>
}
type WorkspaceState = {
  states: Record<string, SingleState>
  mergeManager: ElementMergeManager
}

export const loadWorkspace = async (
  config: WorkspaceConfigSource,
  credentials: ConfigSource,
  enviormentsSources: EnvironmentsSources,
  remoteMapCreator: RemoteMapCreator,
  ignoreFileChanges = false,
  persistent = true,
  mergedRecoveryMode: MergedRecoveryMode = 'rebuild'
): Promise<Workspace> => {
  const workspaceConfig = await config.getWorkspaceConfig()
  log.debug('Loading workspace with id: %s', workspaceConfig.uid)

  if (_.isEmpty(workspaceConfig.envs)) {
    throw new Error('Workspace with no environments is illegal')
  }
  const envs = (): ReadonlyArray<string> => workspaceConfig.envs.map(e => e.name)
  const currentEnv = (): string => workspaceConfig.currentEnv ?? workspaceConfig.envs[0].name
  const getRemoteMapNamespace = (
    namespace: string, env?: string
  ): string => `workspace-${env || currentEnv()}-${namespace}`
  const currentEnvConf = (): EnvConfig =>
    makeArray(workspaceConfig.envs).find(e => e.name === currentEnv()) as EnvConfig
  const currentEnvsConf = (): EnvConfig[] =>
    workspaceConfig.envs
  const services = (): string[] => makeArray(currentEnvConf().services)
  const state = (envName?: string): State => (
    enviormentsSources.sources[envName ?? currentEnv()].state as State
  )
  const createNaclFilesSource = (envName?: string): MultiEnvSource => multiEnvSource(
    _.mapValues(enviormentsSources.sources, e => e.naclFiles),
    envName ?? currentEnv(),
    enviormentsSources.commonSourceName,
    remoteMapCreator,
    persistent,
    mergedRecoveryMode
  )
  let naclFilesSource = createNaclFilesSource()
  let workspaceState: Promise<WorkspaceState> | undefined
  const buildWorkspaceState = async ({
    workspaceChanges = {},
    stateOnlyChanges = {},
    validate = true,
  }: {
    workspaceChanges?: Record<string, ChangeSet<Change>>
    stateOnlyChanges?: Record<string, ChangeSet<Change>>
    validate?: boolean
  }): Promise<WorkspaceState> => {
    const initState = async (): Promise<WorkspaceState> => {
      const states: Record<string, SingleState> = Object.fromEntries(await awu(envs())
        .map(async envName => [envName, {
          merged: new RemoteElementSource(
            await remoteMapCreator<Element>({
              namespace: getRemoteMapNamespace('merged', envName),
              serialize: element => serialize([element], 'keepRef'),
              // TODO: we might need to pass static file reviver to the deserialization func
              deserialize: deserializeSingleElement,
              persistent,
            })
          ),
          errors: await remoteMapCreator<MergeError[]>({
            namespace: getRemoteMapNamespace('errors', envName),
            serialize: mergeErrors => serialize(mergeErrors, 'keepRef'),
            deserialize: async data => deserializeMergeErrors(data),
            persistent,
          }),
          validationErrors: await remoteMapCreator<ValidationError[]>({
            namespace: getRemoteMapNamespace('validationErrors', envName),
            serialize: validationErrors => serialize(validationErrors, 'keepRef'),
            deserialize: async data => deserializeValidationErrors(data),
            persistent,
          }),
        }]).toArray())
      const sources: Record<string, ReadOnlyElementsSource> = {}
      await awu(envs()).forEach(async envName => {
        sources[MULTI_ENV_SOURCE_PREFIX + envName] = await naclFilesSource
          .getElementsSource(envName)
        sources[STATE_SOURCE_PREFIX + envName] = mapReadOnlyElementsSource(
          state(envName),
          async element => getElementHiddenParts(
            element,
            state(envName),
            await states[envName].merged.get(element.elemID)
          )
        )
      })
      const initializedState = {
        states,
        mergeManager: await createMergeManager(
          [...Object.values(states)
            .flatMap(remoteMaps => Object.values(remoteMaps))],
          sources,
          remoteMapCreator,
          'workspaceMergeManager',
          persistent,
          mergedRecoveryMode,
        ),
      }
      await initializedState.mergeManager.init()
      return initializedState
    }

    const initBuild = workspaceState === undefined
    const stateToBuild = workspaceState !== undefined
      ? await workspaceState
      : await initState()
    const updateWorkspace = async (envName: string): Promise<void> => {
      const source = createNaclFilesSource(envName)
      const getElementsDependents = async (
        elemIDs: ElemID[],
        addedIDs: Set<string>
      ): Promise<ElemID[]> => {
        elemIDs.forEach(id => addedIDs.add(id.getFullName()))
        const filesWithDependencies = _.uniq(
          await awu(elemIDs)
            .flatMap(id => source.getElementReferencedFiles(id))
            .toArray()
        )
        const dependentsIDs = _.uniqBy(
          await awu(filesWithDependencies)
            .map(filename => source.getParsedNaclFile(filename))
            .flatMap(async naclFile => ((await naclFile?.elements()) ?? [])
              .map(elem => elem.elemID))
            .filter(id => !addedIDs.has(id.getFullName()))
            .toArray(),
          id => id.getFullName()
        )
        return _.isEmpty(dependentsIDs)
          ? dependentsIDs
          : dependentsIDs.concat(await getElementsDependents(dependentsIDs, addedIDs))
      }
      const validateElementsAndDependents = async (
        elements: ReadonlyArray<Element>,
        elementSource: ReadOnlyElementsSource,
        relevantElementIDs: ElemID[],
      ): Promise<{
        errors: ValidationError[]
        validatedElementsIDs: ElemID[]
      }> => {
        const dependentsID = await getElementsDependents(relevantElementIDs, new Set())
        const dependents = (await Promise.all(dependentsID.map(id => elementSource.get(id))))
          .filter(values.isDefined)
        const elementsToValidate = [...elements, ...dependents]
        return {
          errors: await validateElements(elementsToValidate, elementSource),
          validatedElementsIDs: _.uniqBy(
            [...elementsToValidate.map(elem => elem.elemID), ...relevantElementIDs],
            e => e.getFullName(),
          ),
        }
      }
      // When we load the workspace with a clean cache from existings nacls, we need
      // to add hidden elements from the state since they will not be a part of the nacl
      // changes. In any other load - the state changes will be reflected by the workspace
      // / hidden changes.
      const completeStateOnlyChanges = async (
        partialStateChanges: ChangeSet<Change<Element>>
      ): Promise<ChangeSet<Change<Element>>> => {
        const cacheValid = initBuild
          ? await stateToBuild.mergeManager.getHash(STATE_SOURCE_PREFIX + envName)
            === await state(envName).getHash() && partialStateChanges.cacheValid
          : true
        // We identify a first nacl load when the state is empty, and all of the changes
        // are visible (which indicates a nacl load and not a first 'fetch' in which the
        // hidden changes won't be empty)
        const isFirstInitFromNacls = _.isEmpty(partialStateChanges.changes)
          && (await stateToBuild.states[envName].merged.isEmpty())

        const initHiddenElementsChanges = isFirstInitFromNacls
          ? await awu(await state(envName).getAll())
            .filter(element => isHidden(element, state(envName)))
            .map(elem => toChange({ after: elem })).toArray()
          : []

        const stateRemovedElementChanges = (workspaceChanges[envName] ?? createEmptyChangeSet())
          .changes.filter(change => isRemovalChange(change)
            && getChangeElement(change).elemID.isTopLevel())
        return {
          changes: partialStateChanges.changes
            .concat(initHiddenElementsChanges)
            .concat(stateRemovedElementChanges),
          cacheValid,
          preChangeHash: partialStateChanges.preChangeHash
            ?? await stateToBuild.mergeManager.getHash(STATE_SOURCE_PREFIX + envName),
          postChangeHash: await state(envName).getHash(),
        }
      }

      const workspaceChangedElements = _.keyBy(
        await awu(workspaceChanges[envName]?.changes ?? [])
          .map(change => (isRemovalChange(change) ? undefined : getChangeElement(change)))
          .filter(values.isDefined)
          .map(async workspaceElement => getElementHiddenParts(
            await state(envName).get(workspaceElement.elemID) ?? workspaceElement,
            state(envName),
            workspaceElement
          ))
          .filter(values.isDefined)
          .toArray(),
        elem => elem.elemID.getFullName()
      )

      const changeResult = await stateToBuild.mergeManager.mergeComponents({
        src1Changes: workspaceChanges[envName],
        src2Changes: await completeStateOnlyChanges(
          stateOnlyChanges[envName]
          ?? createEmptyChangeSet(
            await state(envName).getHash()
          )
        ),
        src2Overrides: workspaceChangedElements,
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
      const changedElements = changes
        .filter(isAdditionOrModificationChange)
        .map(getChangeElement)
      const changeIDs = changes.map(getChangeElement).map(elem => elem.elemID)
      if (validate) {
        const {
          errors: validationErrors,
          validatedElementsIDs,
        } = await validateElementsAndDependents(
          changedElements,
          stateToBuild.states[envName].merged,
          changeIDs,
        )
        const validationErrorsById = await awu(validationErrors)
          .groupBy(err => err.elemID.createTopLevelParentID().parent.getFullName())

        const errorsToUpdate = Object.entries(validationErrorsById)
          .map(([elemID, errors]) => ({ key: elemID, value: errors }))

        const elementsWithNoErrors = validatedElementsIDs
          .map(id => id.getFullName())
          .filter(fullname => _.isEmpty(validationErrorsById[fullname]))
        await stateToBuild.states[envName].validationErrors.setAll(errorsToUpdate)
        await stateToBuild.states[envName].validationErrors.deleteAll(elementsWithNoErrors)
      }
    }
    const relevantEnvs = awu(envs())
      .filter(async name =>
        (workspaceChanges[name]?.changes ?? []).length > 0
        || (stateOnlyChanges[name]?.changes ?? []).length > 0
        // Even without changes, it's possible that things moved between common and env
        || workspaceChanges[name]?.postChangeHash
          !== await stateToBuild.mergeManager.getHash(MULTI_ENV_SOURCE_PREFIX + name))

    await relevantEnvs.forEach(async envName => { await updateWorkspace(envName) })
    return stateToBuild
  }

  const getWorkspaceState = async (): Promise<WorkspaceState> => {
    if (_.isUndefined(workspaceState)) {
      const workspaceChanges = await naclFilesSource.load({ ignoreFileChanges })
      workspaceState = buildWorkspaceState({
        workspaceChanges,
      })
    }
    return workspaceState
  }

  const getLoadedNaclFilesSource = async (): Promise<MultiEnvSource> => {
    // We load the nacl file source, and make sure the state of the WS is also
    // updated. (Without this - the load changes will be lost)
    await getWorkspaceState()
    return naclFilesSource
  }

  const elements = async (env?: string): Promise<ElementsSource> =>
    (await getWorkspaceState()).states[env ?? currentEnv()].merged

  const getStateOnlyChanges = async (
    hiddenChanges: DetailedChange[],
  ): Promise<Change[]> => {
    const changesByID = _.groupBy(
      hiddenChanges,
      change => change.id.createTopLevelParentID().parent.getFullName()
    )

    return awu(Object.values(changesByID)).flatMap(async changes => {
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
      const after = await getElementHiddenParts(
        clonedBefore,
        state(),
        before
      )
      return after !== undefined ? [toChange({ before, after })] : []
    }).toArray()
  }
  const updateNaclFiles = async ({
    changes,
    mode,
    stateOnly = false,
    validate = true,
  } : {
      changes: DetailedChange[]
      mode?: RoutingMode
      validate?: boolean
      stateOnly?: boolean
    }) : Promise<number> => {
    const { visible: visibleChanges, hidden: hiddenChanges } = await handleHiddenChanges(
      changes,
      state(),
      (await getLoadedNaclFilesSource()).getAll,
    )
    const workspaceChanges = await ((await getLoadedNaclFilesSource())
      .updateNaclFiles(
        stateOnly ? [] : visibleChanges,
        mode
      ))
    const currentStateHash = workspaceState ? await (await workspaceState)
      .mergeManager.getHash(STATE_SOURCE_PREFIX + currentEnv()) : undefined
    const loadedStateHash = await state(currentEnv()).getHash()
    await state(currentEnv()).calculateHash()
    const postChangeHash = await state(currentEnv()).getHash()
    const stateOnlyChanges = await getStateOnlyChanges(hiddenChanges)
    workspaceState = buildWorkspaceState({ workspaceChanges,
      stateOnlyChanges: { [currentEnv()]: {
        changes: stateOnlyChanges,
        cacheValid: currentStateHash === loadedStateHash,
        preChangeHash: currentStateHash,
        postChangeHash,
      } },
      validate })
    return (Object.values(workspaceChanges).map(changeSet => changeSet.changes)
      .flat().length + stateOnlyChanges.length)
  }
  const setNaclFiles = async (naclFiles: NaclFile[], validate = true): Promise<EnvsChanges> => {
    const elementChanges = await (await getLoadedNaclFilesSource()).setNaclFiles(...naclFiles)
    workspaceState = buildWorkspaceState({ workspaceChanges: elementChanges, validate })
    return elementChanges
  }

  const removeNaclFiles = async (names: string[], validate = true): Promise<EnvsChanges> => {
    const elementChanges = await (await getLoadedNaclFilesSource()).removeNaclFiles(...names)
    workspaceState = buildWorkspaceState({ workspaceChanges: elementChanges, validate })
    return elementChanges
  }

  const getSourceFragment = async (
    sourceRange: SourceRange, subRange?: SourceRange): Promise<SourceFragment> => {
    const naclFile = await (await getLoadedNaclFilesSource()).getNaclFile(sourceRange.filename)
    log.debug(`error context: start=${sourceRange.start.byte}, end=${sourceRange.end.byte}`)
    const fragment = naclFile
      ? naclFile.buffer.substring(sourceRange.start.byte, sourceRange.end.byte)
      : ''
    if (!naclFile) {
      log.warn('failed to resolve source fragment for %o', sourceRange)
    }
    return {
      sourceRange,
      fragment,
      subRange,
    }
  }
  const transformParseError = async (error: ParseError): Promise<WorkspaceError<SaltoError>> => ({
    ...error,
    sourceFragments: [await getSourceFragment(error.context, error.subject)],
  })
  const transformToWorkspaceError = async <T extends SaltoElementError>(saltoElemErr: T):
    Promise<Readonly<WorkspaceError<T>>> => {
    const sourceRanges = await (await getLoadedNaclFilesSource())
      .getSourceRanges(saltoElemErr.elemID)
    const sourceFragments = await awu(sourceRanges)
      .map(range => getSourceFragment(range))
      .toArray()

    return {
      ...saltoElemErr,
      message: saltoElemErr.message,
      sourceFragments,
    }
  }
  const transformError = async (error: SaltoError): Promise<WorkspaceError<SaltoError>> => {
    const isParseError = (err: SaltoError): err is ParseError =>
      _.has(err, 'subject')
    const isElementError = (err: SaltoError): err is SaltoElementError =>
      _.get(err, 'elemID') instanceof ElemID
    if (isParseError(error)) {
      return transformParseError(error)
    }
    if (isElementError(error)) {
      return transformToWorkspaceError(error)
    }
    return { ...error, sourceFragments: [] }
  }

  const errors = async (): Promise<Errors> => {
    const currentState = await getWorkspaceState()
    const loadNaclFileSource = await getLoadedNaclFilesSource()
    // It is important to make sure these are obtain using Promise.all in order to allow
    // the SaaS UI to debouce the DB accesses.
    const [errorsFromSource, validationErrors, mergeErrors] = await Promise.all([
      loadNaclFileSource.getErrors(),
      awu(currentState.states[currentEnv()].validationErrors.values()).flat().toArray(),
      awu(currentState.states[currentEnv()].errors.values()).flat().toArray(),
    ])
    _(validationErrors)
      .groupBy(error => error.constructor.name)
      .entries()
      .forEach(([errorType, errorsGroup]) => {
        log.error(`Invalid elements, error type: ${errorType}, element IDs: ${errorsGroup.map(e => e.elemID.getFullName()).join(', ')}`)
      })
    return new Errors({
      ...errorsFromSource,
      merge: [
        ...errorsFromSource.merge,
        ...mergeErrors,
      ],
      validation: validationErrors,
    })
  }

  const pickServices = (names?: ReadonlyArray<string>): ReadonlyArray<string> =>
    (_.isUndefined(names) ? services() : services().filter(s => names.includes(s)))
  const credsPath = (service: string): string => path.join(currentEnv(), service)
  return {
    uid: workspaceConfig.uid,
    name: workspaceConfig.name,
    elements: async (includeHidden = true, env) => {
      if (includeHidden) {
        return elements(env)
      }
      return ((await getLoadedNaclFilesSource())).getElementsSource(env)
    },
    state,
    envs,
    currentEnv,
    services,
    errors,
    hasErrors: async () => (await errors()).hasErrors(),
    servicesCredentials: async (names?: ReadonlyArray<string>) => _.fromPairs(await Promise.all(
      pickServices(names).map(async service => [service, await credentials.get(credsPath(service))])
    )),
    serviceConfig: (name, defaultValue) => config.getAdapter(name, defaultValue),
    isEmpty: async (naclFilesOnly = false): Promise<boolean> => {
      const isNaclFilesSourceEmpty = !naclFilesSource
        || await (await getLoadedNaclFilesSource()).isEmpty()
      return isNaclFilesSourceEmpty && (naclFilesOnly || state().isEmpty())
    },
    hasElementsInServices: async (serviceNames: string[]): Promise<boolean> => (
      await (awu(await (await getLoadedNaclFilesSource()).list()).find(
        elemId => serviceNames.includes(elemId.adapter)
      )) !== undefined
    ),
    hasElementsInEnv: async envName => {
      const envSource = enviormentsSources.sources[envName]
      if (envSource === undefined) {
        return false
      }
      return !(await envSource.naclFiles.isEmpty())
    },
    envOfFile: filename => getSourceNameForFilename(
      filename, envs() as string[], enviormentsSources.commonSourceName
    ),
    // Returning the functions from the nacl file source directly (eg: promote: src.promote)
    // may seem better, but the setCurrentEnv method replaced the naclFileSource.
    // Passing direct pointer for these functions would have resulted in pointers to a nullified
    // source so we need to wrap all of the function calls to make sure we are forwarding the method
    // invocations to the proper source.
    setNaclFiles,
    updateNaclFiles: (changes, mode, stateOnly) => updateNaclFiles({ changes, mode, stateOnly }),
    removeNaclFiles,
    getSourceMap: async (filename: string) => (
      (await getLoadedNaclFilesSource()).getSourceMap(filename)
    ),
    getSourceRanges: async (elemID: ElemID) => (
      (await getLoadedNaclFilesSource()).getSourceRanges(elemID)
    ),
    listNaclFiles: async () => (
      (await getLoadedNaclFilesSource()).listNaclFiles()
    ),
    getElementIdsBySelectors: async (
      selectors: ElementSelector[], commonOnly = false, compact = false,
    ) => (
      (await getLoadedNaclFilesSource()).getElementIdsBySelectors(selectors, commonOnly, compact)
    ),
    getElementReferencedFiles: async id => (
      (await getLoadedNaclFilesSource()).getElementReferencedFiles(id)
    ),
    getElementNaclFiles: async id => (
      (await getLoadedNaclFilesSource()).getElementNaclFiles(id)
    ),
    getTotalSize: async () => (
      (await getLoadedNaclFilesSource()).getTotalSize()
    ),
    getNaclFile: async (filename: string) => (
      (await getLoadedNaclFilesSource()).getNaclFile(filename)
    ),
    getParsedNaclFile: async (filename: string) => (
      (await getLoadedNaclFilesSource()).getParsedNaclFile(filename)
    ),
    promote: async (ids: ElemID[]) => {
      const workspaceChanges = await (await getLoadedNaclFilesSource()).promote(ids)
      workspaceState = buildWorkspaceState({ workspaceChanges })
    },
    demote: async (ids: ElemID[]) => {
      const workspaceChanges = await (await getLoadedNaclFilesSource()).demote(ids)
      workspaceState = buildWorkspaceState({ workspaceChanges })
    },
    demoteAll: async () => {
      const workspaceChanges = await (await getLoadedNaclFilesSource()).demoteAll()
      workspaceState = buildWorkspaceState({ workspaceChanges })
    },
    copyTo: async (ids: ElemID[], targetEnvs: string[]) => {
      const workspaceChanges = await (await getLoadedNaclFilesSource()).copyTo(ids, targetEnvs)
      workspaceState = buildWorkspaceState({ workspaceChanges })
    },
    transformToWorkspaceError,
    transformError,
    getSourceFragment,
    flush: async (): Promise<void> => {
      if (!persistent) {
        throw new Error('Can not flush a non-persistent workspace.')
      }
      await state().flush()
      await (await getLoadedNaclFilesSource()).flush()
      const currentWSState = await getWorkspaceState()
      await currentWSState.mergeManager.flush()
    },
    clone: (): Promise<Workspace> => {
      const sources = _.mapValues(enviormentsSources.sources, source =>
        ({ naclFiles: source.naclFiles.clone(), state: source.state }))
      const envSources = { commonSourceName: enviormentsSources.commonSourceName, sources }
      return loadWorkspace(config, credentials, envSources, remoteMapCreator)
    },
    clear: async (args: ClearFlags) => {
      const currentWSState = await getWorkspaceState()
      if (args.cache || args.nacl || args.staticResources) {
        if (args.staticResources && !(args.state && args.cache && args.nacl)) {
          throw new Error('Cannot clear static resources without clearing the state, cache and nacls')
        }
        await currentWSState.mergeManager.clear()
        await naclFilesSource.clear(args)
      }
      if (args.state) {
        await promises.array.series(envs().map(e => (() => state(e).clear())))
      }
      if (args.credentials) {
        await promises.array.series(envs().map(e => (() => credentials.delete(e))))
      }
      workspaceState = undefined
      await getWorkspaceState()
    },
    addService: async (service: string): Promise<void> => {
      const currentServices = services() || []
      if (currentServices.includes(service)) {
        throw new ServiceDuplicationError(service)
      }
      currentEnvConf().services = [...currentServices, service]
      await config.setWorkspaceConfig(workspaceConfig)
    },
    updateServiceCredentials:
      async (service: string, servicesCredentials: Readonly<InstanceElement>): Promise<void> =>
        credentials.set(credsPath(service), servicesCredentials),
    updateServiceConfig:
      async (service: string, newConfig: Readonly<InstanceElement>): Promise<void> => {
        await config.setAdapter(service, newConfig)
      },
    addEnvironment: async (env: string): Promise<void> => {
      if (workspaceConfig.envs.map(e => e.name).includes(env)) {
        throw new EnvDuplicationError(env)
      }
      // Need to make sure everything is loaded before we add the new env.
      await getWorkspaceState()
      workspaceConfig.envs = [...workspaceConfig.envs, { name: env }]
      await config.setWorkspaceConfig(workspaceConfig)
    },
    deleteEnvironment: async (env: string): Promise<void> => {
      if (!(workspaceConfig.envs.map(e => e.name).includes(env))) {
        throw new UnknownEnvError(env)
      }
      if (env === currentEnv()) {
        throw new DeleteCurrentEnvError(env)
      }
      workspaceConfig.envs = workspaceConfig.envs.filter(e => e.name !== env)
      await config.setWorkspaceConfig(workspaceConfig)

      // We assume here that all the credentials files sit under the credentials' env directory
      await credentials.delete(env)

      const environmentSource = enviormentsSources.sources[env]
      // ensure that the env is loaded
      await environmentSource.naclFiles.load({})
      if (environmentSource) {
        await environmentSource.naclFiles.clear()
        await environmentSource.state?.clear()
      }
      delete enviormentsSources.sources[env]
      naclFilesSource = multiEnvSource(
        _.mapValues(enviormentsSources.sources, e => e.naclFiles),
        currentEnv(),
        enviormentsSources.commonSourceName,
        remoteMapCreator,
        persistent,
        mergedRecoveryMode
      )
    },
    renameEnvironment: async (envName: string, newEnvName: string, newEnvNaclPath? : string) => {
      const envConfig = envs().find(e => e === envName)
      if (_.isUndefined(envConfig)) {
        throw new UnknownEnvError(envName)
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

      const environmentSource = enviormentsSources.sources[envName]
      if (environmentSource) {
        // ensure that the env is loaded
        await environmentSource.naclFiles.load({})
        await environmentSource.naclFiles.rename(newEnvNaclPath || newEnvName)
        await environmentSource.state?.rename(newEnvName)
      }
      enviormentsSources.sources[newEnvName] = environmentSource
      delete enviormentsSources.sources[envName]
      naclFilesSource = multiEnvSource(
        _.mapValues(enviormentsSources.sources, e => e.naclFiles),
        currentEnv(),
        enviormentsSources.commonSourceName,
        remoteMapCreator,
        persistent,
        mergedRecoveryMode
      )
    },
    setCurrentEnv: async (env: string, persist = true): Promise<void> => {
      if (!envs().includes(env)) {
        throw new UnknownEnvError(env)
      }
      workspaceConfig.currentEnv = env
      if (persist) {
        await config.setWorkspaceConfig(workspaceConfig)
      }
      naclFilesSource = multiEnvSource(
        _.mapValues(enviormentsSources.sources, e => e.naclFiles),
        currentEnv(),
        enviormentsSources.commonSourceName,
        remoteMapCreator,
        persistent,
        mergedRecoveryMode
      )
      workspaceState = undefined
    },

    getStateRecency: async (serviceName: string): Promise<StateRecency> => {
      const staleStateThresholdMs = (workspaceConfig.staleStateThresholdMinutes
        || DEFAULT_STALE_STATE_THRESHOLD_MINUTES) * 60 * 1000
      const date = (await state().getServicesUpdateDates())[serviceName]
      const status = (() => {
        if (date === undefined) {
          return 'Nonexistent'
        }
        if (Date.now() - date.getTime() >= staleStateThresholdMs) {
          return 'Old'
        }
        return 'Valid'
      })()
      return { serviceName, status, date }
    },
    getValue: async (id: ElemID, env?: string): Promise<Value | undefined> => (
      (await elements(env)).get(id)
    ),
    getSearchableNames: async (): Promise<string[]> =>
      (await getLoadedNaclFilesSource()).getSearchableNames(),
    getSearchableNamesOfEnv: async (env?: string): Promise<string[]> =>
      (await getLoadedNaclFilesSource()).getSearchableNamesOfEnv(env),
  }
}

export const initWorkspace = async (
  name: string,
  uid: string,
  defaultEnvName: string,
  config: WorkspaceConfigSource,
  credentials: ConfigSource,
  envs: EnvironmentsSources,
  remoteMapCreator: RemoteMapCreator,
): Promise<Workspace> => {
  log.debug('Initializing workspace with id: %s', uid)
  await config.setWorkspaceConfig({
    uid,
    name,
    envs: [{ name: defaultEnvName }],
    currentEnv: defaultEnvName,
  })
  return loadWorkspace(config, credentials, envs, remoteMapCreator)
}
