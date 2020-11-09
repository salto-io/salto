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
import _ from 'lodash'
import path from 'path'
import {
  Element, SaltoError, SaltoElementError, ElemID, InstanceElement, DetailedChange,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections, promises } from '@salto-io/lowerdash'
import { validateElements } from '../validator'
import { SourceRange, ParseError, SourceMap } from '../parser'
import { ConfigSource } from './config_source'
import { State } from './state'
import { NaclFilesSource, NaclFile, RoutingMode, ParsedNaclFile } from './nacl_files/nacl_files_source'
import { multiEnvSource } from './nacl_files/multi_env/multi_env_source'
import { Errors, ServiceDuplicationError, EnvDuplicationError,
  UnknownEnvError, DeleteCurrentEnvError } from './errors'
import { EnvConfig } from './config/workspace_config_types'
import { mergeWithHidden, handleHiddenChanges } from './hidden_values'
import { WorkspaceConfigSource } from './workspace_config_source'
import { MergeResult } from '../merger'

const log = logger(module)

const { makeArray } = collections.array

export const ADAPTERS_CONFIGS_PATH = 'adapters'
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

  elements: (includeHidden?: boolean, env?: string) => Promise<ReadonlyArray<Element>>
  state: (envName?: string) => State
  envs: () => ReadonlyArray<string>
  currentEnv: () => string
  services: () => ReadonlyArray<string>
  servicesCredentials: (names?: ReadonlyArray<string>) =>
    Promise<Readonly<Record<string, InstanceElement>>>
  servicesConfig: (names?: ReadonlyArray<string>) =>
    Promise<Readonly<Record<string, InstanceElement>>>

  isEmpty(naclFilesOnly?: boolean): Promise<boolean>
  hasElementsInServices(serviceNames: string[]): Promise<boolean>
  getSourceFragment(sourceRange: SourceRange): Promise<SourceFragment>
  hasErrors(): Promise<boolean>
  errors(): Promise<Readonly<Errors>>
  transformToWorkspaceError<T extends SaltoElementError>(saltoElemErr: T):
    Promise<Readonly<WorkspaceError<T>>>
  transformError: (error: SaltoError) => Promise<WorkspaceError<SaltoError>>
  updateNaclFiles: (changes: DetailedChange[], mode?: RoutingMode) => Promise<void>
  listNaclFiles: () => Promise<string[]>
  getTotalSize: () => Promise<number>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  setNaclFiles: (...naclFiles: NaclFile[]) => Promise<void>
  removeNaclFiles: (...names: string[]) => Promise<void>
  getSourceMap: (filename: string) => Promise<SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<SourceRange[]>
  getElementReferencedFiles: (id: ElemID) => Promise<string[]>
  getElementNaclFiles: (id: ElemID) => Promise<string[]>
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
}

// common source has no state
export type EnvironmentSource = { naclFiles: NaclFilesSource; state?: State }
export type EnvironmentsSources = {
  commonSourceName: string
  sources: Record<string, EnvironmentSource>
}

export const loadWorkspace = async (config: WorkspaceConfigSource, credentials: ConfigSource,
  elementsSources: EnvironmentsSources):
  Promise<Workspace> => {
  const workspaceConfig = await config.getWorkspaceConfig()
  if (_.isEmpty(workspaceConfig.envs)) {
    throw new Error('Workspace with no environments is illegal')
  }
  const envs = (): ReadonlyArray<string> => workspaceConfig.envs.map(e => e.name)
  const currentEnv = (): string => workspaceConfig.currentEnv ?? workspaceConfig.envs[0].name
  const currentEnvConf = (): EnvConfig =>
    makeArray(workspaceConfig.envs).find(e => e.name === currentEnv()) as EnvConfig
  const currentEnvsConf = (): EnvConfig[] =>
    workspaceConfig.envs
  const services = (): ReadonlyArray<string> => makeArray(currentEnvConf().services)
  const state = (envName?: string): State => (
    elementsSources.sources[envName || currentEnv()].state as State
  )
  let naclFilesSource = multiEnvSource(_.mapValues(elementsSources.sources, e => e.naclFiles),
    currentEnv(), elementsSources.commonSourceName)

  const elements = async (env?: string): Promise<MergeResult> => {
    const visibleElements = await naclFilesSource.getAll(env)
    const stateElements = await state(env).getAll()
    return mergeWithHidden(visibleElements, stateElements)
  }

  const updateNaclFiles = async (
    changes: DetailedChange[],
    mode?: RoutingMode
  ): Promise<void> => {
    const changesAfterHiddenRemoved = await handleHiddenChanges(
      changes, state(), naclFilesSource.getAll,
    )
    await naclFilesSource.updateNaclFiles(changesAfterHiddenRemoved, mode)
  }

  const getSourceFragment = async (
    sourceRange: SourceRange, subRange?: SourceRange): Promise<SourceFragment> => {
    const naclFile = await naclFilesSource.getNaclFile(sourceRange.filename)
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
    const sourceRanges = await naclFilesSource.getSourceRanges(saltoElemErr.elemID)
    const sourceFragments = await Promise.all(sourceRanges.map(range => getSourceFragment(range)))
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
    const resolvedElements = await elements()
    const errorsFromSource = await naclFilesSource.getErrors()
    return new Errors({
      ...errorsFromSource,
      merge: [...errorsFromSource.merge, ...resolvedElements.errors],
      validation: validateElements(resolvedElements.merged),
    })
  }

  const pickServices = (names?: ReadonlyArray<string>): ReadonlyArray<string> =>
    (_.isUndefined(names) ? services() : services().filter(s => names.includes(s)))
  const credsPath = (service: string): string => path.join(currentEnv(), service)
  return {
    uid: workspaceConfig.uid,
    name: workspaceConfig.name,
    elements: async (includeHidden = true, env) => (
      includeHidden ? (await elements(env)).merged : naclFilesSource.getAll(env)
    ),
    state,
    envs,
    currentEnv,
    services,
    errors,
    hasErrors: async () => (await errors()).hasErrors(),
    servicesCredentials: async (names?: ReadonlyArray<string>) => _.fromPairs(await Promise.all(
      pickServices(names).map(async service => [service, await credentials.get(credsPath(service))])
    )),
    servicesConfig: async (names?: ReadonlyArray<string>) => _.fromPairs(await Promise.all(
      pickServices(names).map(
        async service => [
          service,
          (await config.getAdapter(service)),
        ]
      )
    )),
    isEmpty: async (naclFilesOnly = false): Promise<boolean> => {
      const isNaclFilesSourceEmpty = !naclFilesSource || await naclFilesSource.isEmpty()
      return isNaclFilesSourceEmpty && (naclFilesOnly || _.isEmpty(await state().getAll()))
    },
    hasElementsInServices: async (serviceNames: string[]): Promise<boolean> => (
      (await naclFilesSource.list()).some(
        elemId => serviceNames.includes(elemId.adapter)
      )
    ),
    // Returning the functions from the nacl file source directly (eg: promote: src.promote)
    // may seem better, but the setCurrentEnv method replaced the naclFileSource.
    // Passing direct pointer for these functions would have resulted in pointers to a nullified
    // source so we need to wrap all of the function calls to make sure we are forwarding the method
    // invocations to the proper source.
    setNaclFiles: (...naclFiles: NaclFile[]) => naclFilesSource.setNaclFiles(...naclFiles),
    updateNaclFiles,
    removeNaclFiles: (...names: string[]) => naclFilesSource.removeNaclFiles(...names),
    getSourceMap: (filename: string) => naclFilesSource.getSourceMap(filename),
    getSourceRanges: (elemID: ElemID) => naclFilesSource.getSourceRanges(elemID),
    listNaclFiles: () => naclFilesSource.listNaclFiles(),
    getElementReferencedFiles: id => naclFilesSource.getElementReferencedFiles(id),
    getElementNaclFiles: id => naclFilesSource.getElementNaclFiles(id),
    getTotalSize: () => naclFilesSource.getTotalSize(),
    getNaclFile: (filename: string) => naclFilesSource.getNaclFile(filename),
    getParsedNaclFile: (filename: string) => naclFilesSource.getParsedNaclFile(filename),
    promote: (ids: ElemID[]) => naclFilesSource.promote(ids),
    demote: (ids: ElemID[]) => naclFilesSource.demote(ids),
    demoteAll: () => naclFilesSource.demoteAll(),
    copyTo: (ids: ElemID[], targetEnvs: string[]) => naclFilesSource.copyTo(ids, targetEnvs),
    transformToWorkspaceError,
    transformError,
    getSourceFragment,
    flush: async (): Promise<void> => {
      await state().flush()
      await naclFilesSource.flush()
    },
    clone: (): Promise<Workspace> => {
      const sources = _.mapValues(elementsSources.sources, source =>
        ({ naclFiles: source.naclFiles.clone(), state: source.state }))
      return loadWorkspace(config, credentials,
        { commonSourceName: elementsSources.commonSourceName, sources })
    },
    clear: async (args: Omit<WorkspaceComponents, 'serviceConfig'>) => {
      if (args.cache || args.nacl || args.staticResources) {
        if (args.staticResources && !(args.state && args.cache && args.nacl)) {
          throw new Error('Cannot clear static resources without clearing the state, cache and nacls')
        }
        await naclFilesSource.clear(args)
      }
      if (args.state) {
        await promises.array.series(envs().map(e => (() => state(e).clear())))
      }
      if (args.credentials) {
        await promises.array.series(envs().map(e => (() => credentials.delete(e))))
      }
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

      const environmentSource = elementsSources.sources[env]
      if (environmentSource) {
        await environmentSource.naclFiles.clear()
        await environmentSource.state?.clear()
      }
      delete elementsSources.sources[env]
      naclFilesSource = multiEnvSource(_.mapValues(elementsSources.sources, e => e.naclFiles),
        currentEnv(), elementsSources.commonSourceName)
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
      const environmentSource = elementsSources.sources[envName]
      if (environmentSource) {
        await environmentSource.naclFiles.rename(newEnvNaclPath || newEnvName)
        await environmentSource.state?.rename(newEnvName)
      }
      elementsSources.sources[newEnvName] = environmentSource
      delete elementsSources.sources[envName]
      naclFilesSource = multiEnvSource(_.mapValues(elementsSources.sources, e => e.naclFiles),
        currentEnv(), elementsSources.commonSourceName)
    },
    setCurrentEnv: async (env: string, persist = true): Promise<void> => {
      if (!envs().includes(env)) {
        throw new UnknownEnvError(env)
      }
      workspaceConfig.currentEnv = env
      if (persist) {
        await config.setWorkspaceConfig(workspaceConfig)
      }
      naclFilesSource = multiEnvSource(_.mapValues(elementsSources.sources, e => e.naclFiles),
        currentEnv(), elementsSources.commonSourceName)
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
  }
}

export const initWorkspace = async (
  name: string,
  uid: string,
  defaultEnvName: string,
  config: WorkspaceConfigSource,
  credentials: ConfigSource,
  envs: EnvironmentsSources,
): Promise<Workspace> => {
  await config.setWorkspaceConfig({
    uid,
    name,
    envs: [{ name: defaultEnvName }],
    currentEnv: defaultEnvName,
  })
  return loadWorkspace(config, credentials, envs)
}
