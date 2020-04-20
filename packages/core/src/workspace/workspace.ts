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
  Element, SaltoError, SaltoElementError, ElemID, InstanceElement, isObjectType, isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { DetailedChange } from '../core/plan'
import { validateElements } from '../core/validator'
import { SourceRange, ParseError, SourceMap } from '../parser/parse'
import { ConfigSource } from './config_source'
import State from './state'
import { NaclFilesSource, NaclFile, RoutingMode } from './nacl_files/nacl_files_source'
import { multiEnvSource } from './nacl_files/mutil_env/multi_env_source'
import { Errors } from './errors'
import { WORKSPACE_CONFIG_NAME, USER_CONFIG_NAME, workspaceConfigTypes, WorkspaceConfig, WorkspaceUserConfig, EnvConfig, workspaceConfigInstance, workspaceUserConfigInstance } from './workspace_config_types'

const log = logger(module)

const { makeArray } = collections.array

export const ADAPTERS_CONFIGS_PATH = 'adapters'
export const DEFAULT_STALE_STATE_THRESHOLD_MINUTES = 60 * 24 * 7 // 7 days

export type WorkspaceError<T extends SaltoError> = Readonly<T & {
  sourceFragments: SourceFragment[]
}>

export type SourceFragment = {
  sourceRange: SourceRange
  fragment: string
}

class EnvDuplicationError extends Error {
  constructor(envName: string) {
    super(`${envName} is already defined in this workspace`)
  }
}

class ServiceDuplicationError extends Error {
  constructor(service: string) {
    super(`${service} is already defined in this workspace`)
  }
}

class UnknownEnvError extends Error {
  constructor(envName: string) {
    super(`Unkown enviornment ${envName}`)
  }
}

export class NoWorkspaceConfig extends Error {
  constructor() {
    super('cannot find workspace config')
  }
}

type RecencyStatus = 'Old' | 'Nonexistent' | 'Valid'
export type StateRecency = {
  status: RecencyStatus
  date: Date | undefined
}

export type Workspace = {
  uid: string
  name: string

  elements: () => Promise<ReadonlyArray<Element>>
  state: () => State
  envs: () => ReadonlyArray<string>
  currentEnv: () => string
  services: () => ReadonlyArray<string>
  servicesCredentials: (names?: ReadonlyArray<string>) =>
    Promise<Readonly<Record<string, InstanceElement>>>
  servicesConfig: (names?: ReadonlyArray<string>) =>
    Promise<Readonly<Record<string, InstanceElement>>>

  isEmpty(naclFilesOnly?: boolean): Promise<boolean>
  getSourceFragment(sourceRange: SourceRange): Promise<SourceFragment>
  hasErrors(): Promise<boolean>
  errors(): Promise<Readonly<Errors>>
  transformToWorkspaceError<T extends SaltoElementError>(saltoElemErr: T):
    Promise<Readonly<WorkspaceError<T>>>
  transformError: (error: SaltoError) => Promise<WorkspaceError<SaltoError>>
  updateNaclFiles: (changes: DetailedChange[], mode?: RoutingMode) => Promise<void>
  listNaclFiles: () => Promise<string[]>
  getNaclFile: (filename: string) => Promise<NaclFile | undefined>
  setNaclFiles: (...naclFiles: NaclFile[]) => Promise<void>
  removeNaclFiles: (...names: string[]) => Promise<void>
  getSourceMap: (filename: string) => Promise<SourceMap>
  getSourceRanges: (elemID: ElemID) => Promise<SourceRange[]>
  getElements: (filename: string) => Promise<Element[]>
  flush: () => Promise<void>
  clone: () => Promise<Workspace>

  addService: (service: string) => Promise<void>
  addEnvironment: (env: string) => Promise<void>
  setCurrentEnv: (env: string, persist?: boolean) => Promise<void>
  updateServiceCredentials: (service: string, creds: Readonly<InstanceElement>) => Promise<void>
  updateServiceConfig: (service: string, newConfig: Readonly<InstanceElement>) => Promise<void>

  getStateRecency(): Promise<StateRecency>
}

// common source has no state
export type EnviornmentSource = { naclFiles: NaclFilesSource; state?: State }
export type EnviornmentsSources = {
  commonSourceName: string
  sources: Record<string, EnviornmentSource>
}
export const loadWorkspace = async (config: ConfigSource, credentials: ConfigSource,
  elementsSources: EnviornmentsSources):
  Promise<Workspace> => {
  const workspaceConfig = (await config.get(WORKSPACE_CONFIG_NAME))?.value as WorkspaceConfig
  if (_.isUndefined(workspaceConfig)) {
    throw new NoWorkspaceConfig()
  }
  if (_.isEmpty(workspaceConfig.envs)) {
    throw new Error('Workspace with no environments is illegal')
  }
  const envs = (): ReadonlyArray<string> => workspaceConfig.envs.map(e => e.name)
  const userConfig = (await config.get(USER_CONFIG_NAME))?.value as WorkspaceUserConfig
    || { currentEnv: envs()[0] }
  const currentEnv = (): string => userConfig.currentEnv
  const currentEnvConf = (): EnvConfig =>
    makeArray(workspaceConfig.envs).find(e => e.name === currentEnv()) as EnvConfig
  const services = (): ReadonlyArray<string> => makeArray(currentEnvConf().services)
  const state = (): State => elementsSources.sources[currentEnv()].state as State
  let naclFilesSource = multiEnvSource(_.mapValues(elementsSources.sources, e => e.naclFiles),
    currentEnv(), elementsSources.commonSourceName)
  const elements = async (): Promise<ReadonlyArray<Element>> => (await naclFilesSource.getAll())
    .concat(workspaceConfigTypes)

  const getSourceFragment = async (sourceRange: SourceRange): Promise<SourceFragment> => {
    const naclFile = await naclFilesSource.getNaclFile(sourceRange.filename)
    const fragment = naclFile
      ? naclFile.buffer.substring(sourceRange.start.byte, sourceRange.end.byte)
      : ''
    if (!naclFile) {
      log.warn('failed to resolve source fragment for %o', sourceRange)
    }
    return {
      sourceRange,
      fragment,
    }
  }
  const transformParseError = async (error: ParseError): Promise<WorkspaceError<SaltoError>> => ({
    ...error,
    sourceFragments: [await getSourceFragment(error.subject)],
  })
  const transformToWorkspaceError = async <T extends SaltoElementError>(saltoElemErr: T):
    Promise<Readonly<WorkspaceError<T>>> => {
    const sourceRanges = await naclFilesSource.getSourceRanges(saltoElemErr.elemID)
    const sourceFragments = await Promise.all(sourceRanges.map(getSourceFragment))
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
    return new Errors({
      ...await naclFilesSource.getErrors(),
      validation: validateElements(resolvedElements),
    })
  }

  const pickServices = (names?: ReadonlyArray<string>): ReadonlyArray<string> =>
    (_.isUndefined(names) ? services() : services().filter(s => names.includes(s)))
  const credsPath = (service: string): string => path.join(currentEnv(), service)
  const confPath = (service: string): string => path.join(ADAPTERS_CONFIGS_PATH, service)
  return {
    uid: workspaceConfig.uid,
    name: workspaceConfig.name,
    elements,
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
      pickServices(names).map(async service => [service, await config.get(confPath(service))])
    )),
    isEmpty: async (naclFilesOnly = false): Promise<boolean> => {
      const isNaclFilesSourceEmpty = _.isEmpty(await naclFilesSource.getAll())
      const isConfig = (elem: Element): boolean =>
        (isObjectType(elem) && workspaceConfigTypes.includes(elem))
          || (isInstanceElement(elem) && workspaceConfigTypes.includes(elem.type))
      const isStateEmpty = _.isEmpty((await state().getAll()).filter(e => !isConfig(e)))
      return naclFilesOnly === true
        ? isNaclFilesSourceEmpty
        : isNaclFilesSourceEmpty && isStateEmpty
    },
    setNaclFiles: naclFilesSource.setNaclFiles,
    updateNaclFiles: naclFilesSource.updateNaclFiles,
    removeNaclFiles: naclFilesSource.removeNaclFiles,
    getSourceMap: naclFilesSource.getSourceMap,
    getSourceRanges: naclFilesSource.getSourceRanges,
    listNaclFiles: naclFilesSource.listNaclFiles,
    getNaclFile: naclFilesSource.getNaclFile,
    getElements: naclFilesSource.getElements,
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

    addService: async (service: string): Promise<void> => {
      const currentServices = services() || []
      if (currentServices.includes(service)) {
        throw new ServiceDuplicationError(service)
      }
      currentEnvConf().services = [...services(), service]
      await config.set(WORKSPACE_CONFIG_NAME, workspaceConfigInstance(workspaceConfig))
    },
    updateServiceCredentials:
      async (service: string, servicesCredentials: Readonly<InstanceElement>): Promise<void> =>
        credentials.set(credsPath(service), servicesCredentials),
    updateServiceConfig:
      async (service: string, newConfig: Readonly<InstanceElement>): Promise<void> =>
        config.set(confPath(service), newConfig),
    addEnvironment: async (env: string): Promise<void> => {
      if (workspaceConfig.envs.map(e => e.name).includes(env)) {
        throw new EnvDuplicationError(env)
      }
      workspaceConfig.envs = [...workspaceConfig.envs, { name: env }]
      await config.set(WORKSPACE_CONFIG_NAME, workspaceConfigInstance(workspaceConfig))
    },
    setCurrentEnv: async (env: string, persist?: boolean): Promise<void> => {
      if (!envs().includes(env)) {
        throw new UnknownEnvError(env)
      }
      userConfig.currentEnv = env
      if (_.isUndefined(persist) || persist === true) {
        await config.set(USER_CONFIG_NAME, workspaceUserConfigInstance(userConfig))
      }
      naclFilesSource = multiEnvSource(_.mapValues(elementsSources.sources, e => e.naclFiles),
        currentEnv(), elementsSources.commonSourceName)
    },

    getStateRecency: async (): Promise<StateRecency> => {
      const staleStateThresholdMs = (workspaceConfig.staleStateThresholdMinutes
        || DEFAULT_STALE_STATE_THRESHOLD_MINUTES) * 60 * 1000
      const date = await state().getUpdateDate()
      const status = (() => {
        if (date === undefined) {
          return 'Nonexistent'
        }
        if (Date.now() - date.getTime() >= staleStateThresholdMs) {
          return 'Old'
        }
        return 'Valid'
      })()
      return { status, date }
    },
  }
}

export const initWorkspace = async (
  name: string,
  uid: string,
  defaultEnvName: string,
  config: ConfigSource,
  credentials: ConfigSource,
  envs: EnviornmentsSources,
): Promise<Workspace> => {
  await config.set(WORKSPACE_CONFIG_NAME, workspaceConfigInstance(
    { uid, name, envs: [{ name: defaultEnvName }] }
  ))
  await config.set(USER_CONFIG_NAME, workspaceUserConfigInstance(
    { currentEnv: defaultEnvName }
  ))
  return loadWorkspace(config, credentials, envs)
}
