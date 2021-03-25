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
  Value, toChange, isRemovalChange, getChangeElement, isAdditionChange, isObjectType, ObjectType,
  isModificationChange, isObjectTypeChange, ReadOnlyElementsSource, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { applyDetailedChanges, safeJsonStringify } from '@salto-io/adapter-utils'
import { collections, promises, values } from '@salto-io/lowerdash'
import { ValidationError, validateElements } from '../validator'
import { SourceRange, ParseError, SourceMap } from '../parser'
import { ConfigSource } from './config_source'
import { State } from './state'
import { multiEnvSource, getSourceNameForFilename, MultiEnvSource } from './nacl_files/multi_env/multi_env_source'
import { NaclFilesSource, NaclFile, RoutingMode } from './nacl_files/nacl_files_source'
import { ParsedNaclFile } from './nacl_files/parsed_nacl_file'
import { ElementSelector } from './element_selector'
import { Errors, ServiceDuplicationError, EnvDuplicationError, UnknownEnvError, DeleteCurrentEnvError } from './errors'
import { EnvConfig } from './config/workspace_config_types'
import { handleHiddenChanges, getElementHiddenParts, isHidden } from './hidden_values'
import { WorkspaceConfigSource } from './workspace_config_source'
import { MergeError, mergeElements } from '../merger'
import { RemoteElementSource, ElementsSource, mapReadOnlyElementsSource } from './elements_source'
import { buildNewMergedElementsAndErrors, getAfterElements } from './nacl_files/elements_cache'
import { RemoteMap, RemoteMapCreator } from './remote_map'
import { serialize, deserializeMergeErrors, deserializeSingleElement, deserializeValidationErrors } from '../serializer/elements'

const log = logger(module)

const { makeArray } = collections.array
const { awu } = collections.asynciterable

export const ADAPTERS_CONFIGS_PATH = 'adapters'
export const COMMON_ENV_PREFIX = ''
const DEFAULT_STALE_STATE_THRESHOLD_MINUTES = 60 * 24 * 7 // 7 days

export type WorkspaceError<T extends SaltoError> = Readonly<T & {
  sourceFragments: SourceFragment[]
}>

export type SourceFragment = {
  sourceRange: SourceRange
  fragment: string
  subRange?: SourceRange
}

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
  updateNaclFiles: (changes: DetailedChange[], mode?: RoutingMode) => Promise<number>
  listNaclFiles: () => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  setNaclFiles: (naclFiles: NaclFile[], validate?: boolean) => Promise<Change[]>
  removeNaclFiles: (names: string[], validate?: boolean) => Promise<Change[]>
  getSourceMap: (filename: string) => Promise<SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<SourceRange[]>
  getElementReferencedFiles: (id: ElemID) => Promise<string[]>
  getElementNaclFiles: (id: ElemID) => Promise<string[]>
  getElementIdsBySelectors: (selectors: ElementSelector[],
    commonOnly?: boolean) => Promise<AsyncIterable<ElemID>>
  getParsedNaclFile: (filename: string) => Promise<ParsedNaclFile | undefined>
  flush: () => Promise<void>
  clone: () => Promise<Workspace>
  clear: (args: Omit<WorkspaceComponents, 'serviceConfig'>) => Promise<void>

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
}

// common source has no state
export type EnvironmentSource = { naclFiles: NaclFilesSource; state?: State }
export type EnvironmentsSources = {
  commonSourceName: string
  sources: Record<string, EnvironmentSource>
}

type WorkspaceState = {
  merged: ElementsSource
  errors: RemoteMap<MergeError[]>
  searchableNamesIndex: RemoteMap<boolean>
  validationErrors: RemoteMap<ValidationError[]>
}

export const loadWorkspace = async (
  config: WorkspaceConfigSource,
  credentials: ConfigSource,
  enviormentsSources: EnvironmentsSources,
  remoteMapCreator: RemoteMapCreator,
  ignoreFileChanges = false,
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
  let naclFilesSource = multiEnvSource(_.mapValues(enviormentsSources.sources, e => e.naclFiles),
    currentEnv(), enviormentsSources.commonSourceName, remoteMapCreator)
  let workspaceState: Promise<WorkspaceState> | undefined

  const buildWorkspaceState = async ({
    workspaceChanges = [],
    env,
    stateOnlyChanges = [],
    validate = true,
  }: {
    workspaceChanges?: Change<Element>[]
    env?: string
    stateOnlyChanges?: Change<Element>[]
    validate?: boolean
  }): Promise<WorkspaceState> => {
    const actualEnv = env ?? currentEnv()
    const stateToBuild = workspaceState !== undefined && actualEnv === currentEnv()
      ? await workspaceState : {
        merged: new RemoteElementSource(
          await remoteMapCreator<Element>({
            namespace: getRemoteMapNamespace('merged', actualEnv),
            serialize: element => serialize([element]),
            // TODO: we might need to pass static file reviver to the deserialization func
            deserialize: deserializeSingleElement,
          })
        ),
        errors: await remoteMapCreator<MergeError[]>({
          namespace: getRemoteMapNamespace('errors', actualEnv),
          serialize: mergeErrors => serialize(mergeErrors),
          deserialize: async data => deserializeMergeErrors(data),
        }),
        searchableNamesIndex: await remoteMapCreator<boolean>({
          namespace: getRemoteMapNamespace('searchableNamesIndex', actualEnv),
          serialize: b => safeJsonStringify(b),
          deserialize: async data => JSON.parse(data),
        }),
        validationErrors: await remoteMapCreator<ValidationError[]>({
          namespace: getRemoteMapNamespace('validationErrors', actualEnv),
          serialize: validationErrors => serialize(validationErrors),
          deserialize: async data => deserializeValidationErrors(data),
        }),
      }

    const getElementsDependents = async (
      elemIDs: ElemID[],
      addedIDs: Set<string>
    ): Promise<ElemID[]> => {
      elemIDs.forEach(id => addedIDs.add(id.getFullName()))
      const filesWithDependencies = _.uniq(
        await awu(elemIDs)
          .flatMap(id => naclFilesSource.getElementReferencedFiles(id))
          .toArray()
      )

      const dependentsIDs = _.uniqBy(
        await awu(filesWithDependencies)
          .map(filename => naclFilesSource.getParsedNaclFile(filename))
          .flatMap(async naclFile => ((await naclFile?.elements()) ?? []).map(elem => elem.elemID))
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
      const dependents = await awu(dependentsID)
        .map(id => elementSource.get(id))
        .filter(values.isDefined)
        .toArray()
      const elementsToValidate = [...elements, ...dependents]
      return {
        errors: await validateElements(elementsToValidate, elementSource),
        validatedElementsIDs: elementsToValidate.map(elem => elem.elemID),
      }
    }

    // When we load the workspace with a clean cache from existings nacls, we need
    // to add hidden elements from the state since they will not be a part of the nacl
    // changes. In any other load - the state changes will be reflected by the workspace
    // / hiden changes.
    const completeStateOnlyChanges = async (
      partialStateChanges: Change<Element>[]
    ): Promise<Change<Element>[]> => {
      // We identify a first nacl load when the state is empty, and all of the changes
      // are visible (which indicates a nacl load and not a first 'fetch' in which the
      // hidden changes won't be empty)
      const isFirstInitFromNacls = await awu(await stateToBuild.merged.getAll()).isEmpty()
        && _.isEmpty(partialStateChanges)

      const initHiddenElementsChanges = isFirstInitFromNacls
        ? await awu(await state().getAll()).filter(element => isHidden(element, state()))
          .map(elem => toChange({ after: elem })).toArray()
        : []

      const stateRemovedElementChanges = workspaceChanges
        .filter(change => isRemovalChange(change) && getChangeElement(change).elemID.isTopLevel())

      return partialStateChanges
        .concat(initHiddenElementsChanges)
        .concat(stateRemovedElementChanges)
    }

    const getFieldsElemIDsFullName = (objectType: ObjectType): string[] =>
      Object.values(objectType.fields).map(field => field.elemID.getFullName())

    const updateSearchableNamesIndex = async (
      changes: Change[]
    ): Promise<void> => {
      const getRelevantNamesFromChange = (change: Change): string[] => {
        const element = getChangeElement(change)
        const fieldsNames = isObjectType(element)
          ? getFieldsElemIDsFullName(element)
          : []
        return [element.elemID.getFullName(), ...fieldsNames]
      }
      const [additions, removals] = _.partition(changes.flatMap(change => {
        if (isModificationChange(change)) {
          if (isObjectTypeChange(change)) {
            const beforeFields = Object.values(change.data.before.fields)
            const afterFields = Object.values(change.data.after.fields)
            const additionFields = afterFields
              .filter(field => !beforeFields.find(f => f.elemID.isEqual(field.elemID)))
            const removalFields = beforeFields
              .filter(field => !afterFields.find(f => f.elemID.isEqual(field.elemID)))
            return [
              ...additionFields.map(f => toChange({ after: f })),
              ...removalFields.map(f => toChange({ before: f })),
            ]
          }
        }
        return change
      }).filter(change => !isModificationChange(change)),
      isAdditionChange)
      const additionsNames = additions.flatMap(getRelevantNamesFromChange)
      await stateToBuild.searchableNamesIndex
        .setAll(additionsNames.map(name => ({ key: name, value: true })))
      const removalNames = removals.flatMap(getRelevantNamesFromChange)
      await stateToBuild.searchableNamesIndex
        .deleteAll(removalNames)
    }

    const mergeData = await getAfterElements({
      src1Changes: workspaceChanges,
      src1: await naclFilesSource.getElementsSource(),
      src2Changes: await completeStateOnlyChanges(stateOnlyChanges),
      src2: mapReadOnlyElementsSource(
        state(),
        async element => getElementHiddenParts(
          element,
          state(),
          await stateToBuild.merged.get(element.elemID)
        )
      ),
    })

    const changes = await buildNewMergedElementsAndErrors({
      currentElements: stateToBuild.merged,
      currentErrors: stateToBuild.errors,
      mergeFunc: elements => mergeElements(elements),
      ...mergeData,
    })
    await updateSearchableNamesIndex(changes)
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
        stateToBuild.merged,
        changeIDs,
      )
      const validationErrorsById = await awu(validationErrors)
        .groupBy(err => err.elemID.createTopLevelParentID().parent.getFullName())

      const errorsToUpdate = Object.entries(validationErrorsById)
        .map(([elemID, errors]) => ({ key: elemID, value: errors }))

      const elementsWithNoErrors = validatedElementsIDs
        .map(id => id.getFullName())
        .filter(fullname => _.isEmpty(validationErrorsById[fullname]))

      await stateToBuild.validationErrors.setAll(errorsToUpdate)
      await stateToBuild.validationErrors.deleteAll(elementsWithNoErrors)
    }
    return stateToBuild
  }


  const getWorkspaceState = async (): Promise<WorkspaceState> => {
    if (_.isUndefined(workspaceState)) {
      const workspaceChanges = await naclFilesSource.load({ ignoreFileChanges })
      workspaceState = buildWorkspaceState({ workspaceChanges })
    }
    return workspaceState
  }

  const getLoadedNaclFilesSource = async (): Promise<MultiEnvSource> => {
    // We load the nacl file source, and make sure the state of the WS is also
    // updated. (Without this - the load changes will be lost)
    await getWorkspaceState()
    return naclFilesSource
  }

  const elements = async (env?: string): Promise<WorkspaceState> => {
    if (env && env !== currentEnv()) {
      const changes = await naclFilesSource.load({ env })
      return buildWorkspaceState({ env, workspaceChanges: changes })
    }
    return getWorkspaceState()
  }

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
        return changes as Change[]
      }
      const before = await state().get(refID.createTopLevelParentID().parent)
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

  const updateNaclFiles = async (
    changes: DetailedChange[],
    mode?: RoutingMode,
    validate = true,
  ): Promise<number> => {
    const { visible: visibleChanges, hidden: hiddenChanges } = await handleHiddenChanges(
      changes,
      state(),
      (await getLoadedNaclFilesSource()).getAll,
    )
    const workspaceChanges = await (await getLoadedNaclFilesSource())
      .updateNaclFiles(visibleChanges, mode)
    const stateOnlyChanges = await getStateOnlyChanges(hiddenChanges)
    workspaceState = buildWorkspaceState({ workspaceChanges, stateOnlyChanges, validate })
    return (workspaceChanges.length + stateOnlyChanges.length)
  }

  const setNaclFiles = async (naclFiles: NaclFile[], validate = true): Promise<Change[]> => {
    const elementChanges = await (await getLoadedNaclFilesSource()).setNaclFiles(...naclFiles)
    workspaceState = buildWorkspaceState({ workspaceChanges: elementChanges, validate })
    return elementChanges
  }

  const removeNaclFiles = async (names: string[], validate = true): Promise<Change[]> => {
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
    const errorsFromSource = await (await getLoadedNaclFilesSource()).getErrors()
    const validationErrors = await awu(currentState.validationErrors.values()).flat().toArray()
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
        ...(await awu(currentState.errors.values()).flat().toArray()),
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
        return (await elements(env)).merged
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
    updateNaclFiles,
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
    getElementIdsBySelectors: async (selectors: ElementSelector[],
      commonOnly = false) => (
      (await getLoadedNaclFilesSource()).getElementIdsBySelectors(selectors, commonOnly)
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
    promote: async (ids: ElemID[]) => (
      (await getLoadedNaclFilesSource()).promote(ids)
    ),
    demote: async (ids: ElemID[]) => (await getLoadedNaclFilesSource()).demote(ids),
    demoteAll: async () => (await getLoadedNaclFilesSource()).demoteAll(),
    copyTo: async (ids: ElemID[],
      targetEnvs: string[]) => (await getLoadedNaclFilesSource()).copyTo(ids, targetEnvs),
    transformToWorkspaceError,
    transformError,
    getSourceFragment,
    flush: async (): Promise<void> => {
      const currentWSState = await getWorkspaceState()
      await state().flush()
      await (await getLoadedNaclFilesSource()).flush()
      await currentWSState.merged.flush()
      await currentWSState.errors.flush()
      await currentWSState.searchableNamesIndex.flush()
      await currentWSState.validationErrors.flush()
    },
    clone: (): Promise<Workspace> => {
      const sources = _.mapValues(enviormentsSources.sources, source =>
        ({ naclFiles: source.naclFiles.clone(), state: source.state }))
      const envSources = { commonSourceName: enviormentsSources.commonSourceName, sources }
      return loadWorkspace(config, credentials, envSources, remoteMapCreator)
    },
    clear: async (args: Omit<WorkspaceComponents, 'serviceConfig'>) => {
      if (args.cache || args.nacl || args.staticResources) {
        if (args.staticResources && !(args.state && args.cache && args.nacl)) {
          throw new Error('Cannot clear static resources without clearing the state, cache and nacls')
        }
        const currentWSState = await getWorkspaceState()
        await currentWSState.merged.clear()
        await currentWSState.errors.clear()
        await currentWSState.searchableNamesIndex.clear()
        await currentWSState.validationErrors.clear()
        await (await getLoadedNaclFilesSource()).clear(args)
      }
      if (args.state) {
        await promises.array.series(envs().map(e => (() => state(e).clear())))
      }
      if (args.credentials) {
        await promises.array.series(envs().map(e => (() => credentials.delete(e))))
      }
      workspaceState = buildWorkspaceState({})
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
      (await elements(env)).merged.get(id)
    ),
    getSearchableNames: async (): Promise<string[]> => {
      // We update the WS state before to ensure the load changes will not be lost
      await getWorkspaceState()
      return (
        awu((await workspaceState)?.searchableNamesIndex?.keys() ?? []).toArray()
      )
    },
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
