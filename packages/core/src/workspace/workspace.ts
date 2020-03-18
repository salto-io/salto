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
import {
  Element, SaltoError, SaltoElementError, ElemID, CORE_ANNOTATIONS, ObjectType, Field, BuiltinTypes,
  InstanceElement,
  ListType,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { DetailedChange } from '../core/plan'
import { validateElements } from '../core/validator'
import { SourceRange, ParseError, SourceMap } from '../parser/parse'
import { ConfigSource } from './config_source'
import State from './state'
import { BlueprintsSource, Blueprint, RoutingMode } from './blueprints/blueprints_source'
import { multiEnvSource } from './blueprints/mutil_env/multi_env_source'
import { Errors } from './errors'

const log = logger(module)

const { makeArray } = collections.array

export const COMMON_ENV_PREFIX = ''
const MAX_ERROR_NUMBER = 30

const SALTO = 'salto'
export const WORKSPACE_CONFIG = 'config'
export const PREFERENCE_CONFIG = 'preference'
const ADAPTERS_CONFIGS = 'adapters'
const ENV_CONFIG = 'env'
const CREDENTIALS_CONFIG = 'credentials'

export type WorkspaceError<T extends SaltoError> = Readonly<T & {
  sourceFragments: SourceFragment[]
}>

export type SourceFragment = {
  sourceRange: SourceRange
  fragment: string
}

class EnvDuplicationError extends Error {
  constructor(envName: string) {
    super(`${envName} is already defined at this workspace`)
  }
}

class ServiceDuplicationError extends Error {
  constructor(service: string) {
    super(`${service} is already defined at this workspace`)
  }
}

class UnknownEnvError extends Error {
  constructor(envName: string) {
    super(`Unkown enviornment ${envName}`)
  }
}

const requireAnno = { [CORE_ANNOTATIONS.REQUIRED]: true }
const envConfigElemID = new ElemID(SALTO, ENV_CONFIG)
export const envConfigType = new ObjectType({
  elemID: envConfigElemID,
  fields: {
    name: new Field(envConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    services: new Field(envConfigElemID, 'services', new ListType(BuiltinTypes.STRING)),
  },
})

const workspaceConfigElemID = new ElemID(SALTO)
export const workspaceConfigType = new ObjectType({
  elemID: workspaceConfigElemID,
  fields: {
    uid: new Field(workspaceConfigElemID, 'uid', BuiltinTypes.STRING, requireAnno),
    name: new Field(workspaceConfigElemID, 'name', BuiltinTypes.STRING, requireAnno),
    envs: new Field(workspaceConfigElemID, 'envs', new ListType(envConfigType)),
    staleStateThresholdMinutes: new Field(workspaceConfigElemID, 'staleStateThresholdMinutes', BuiltinTypes.NUMBER),
  },
  isSettings: true,
})

export const preferencesWorkspaceConfigType = new ObjectType({
  elemID: workspaceConfigElemID,
  fields: {
    currentEnv: new Field(workspaceConfigElemID, 'currentEnv', BuiltinTypes.STRING, requireAnno),
  },
  isSettings: true,
})

type RecencyStatus = 'Old' | 'Nonexistent' | 'Valid'
export type StateRecency = {
  status: RecencyStatus
  date: Date | null
}

export type Workspace = {
  uid: string
  name: string

  elements: () => Promise<ReadonlyArray<Element>>
  state: () => State
  envs: () => ReadonlyArray<string>
  currentEnv: () => string
  services: () => ReadonlyArray<string>
  servicesCredentials: () => Promise<Readonly<Record<string, InstanceElement>>>
  servicesConfig: () => Promise<Readonly<Record<string, InstanceElement>>>

  isEmpty(blueprintsOnly?: boolean): Promise<boolean>
  getSourceFragment(sourceRange: SourceRange): Promise<SourceFragment>
  hasErrors(): Promise<boolean>
  errors(): Promise<Readonly<Errors>>
  transformToWorkspaceError<T extends SaltoElementError>(saltoElemErr: T):
    Promise<Readonly<WorkspaceError<T>>>
  transformError: (error: SaltoError) => Promise<WorkspaceError<SaltoError>>
  getWorkspaceErrors(): Promise<ReadonlyArray<WorkspaceError<SaltoError>>>
  updateBlueprints: (changes: DetailedChange[], mode?: RoutingMode) => Promise<void>
  listBlueprints: () => Promise<string[]>
  getBlueprint: (filename: string) => Promise<Blueprint | undefined>
  setBlueprints: (...blueprints: Blueprint[]) => Promise<void>
  removeBlueprints: (...names: string[]) => Promise<void>
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
export type EnviornmentSource = { blueprints: BlueprintsSource; state?: State }
export type EnviornmentsSources = Record<string, EnviornmentSource>
export const loadWorkspace = async (config: ConfigSource, elementsSources: EnviornmentsSources):
  Promise<Workspace> => {
    type EnvConfig = {
      name: string
      services: string[]
    }

    const workspaceConfig = await config.get(WORKSPACE_CONFIG) as InstanceElement
    const preferences = await config.get(PREFERENCE_CONFIG) as InstanceElement
    const currentEnv = (): string => preferences.value.currentEnv
    const currentEnvConf = (): EnvConfig =>
      makeArray(workspaceConfig.value.envs).find(e => e.name === currentEnv())
    const envs = (): ReadonlyArray<string> => makeArray(workspaceConfig.value.envs).map(e => e.name)
    const services = (): ReadonlyArray<string> => currentEnvConf().services
    const state = (): State => elementsSources[currentEnv()].state as State
    let blueprintsSource = multiEnvSource(_.mapValues(elementsSources, e => e.blueprints),
      currentEnv(), COMMON_ENV_PREFIX)
    const elements = async (): Promise<ReadonlyArray<Element>> => (await blueprintsSource.getAll())
      .concat(workspaceConfigType, envConfigType, preferencesWorkspaceConfigType)

    const getSourceFragment = async (sourceRange: SourceRange): Promise<SourceFragment> => {
      const bp = await blueprintsSource.getBlueprint(sourceRange.filename)
      const fragment = bp ? bp.buffer.substring(sourceRange.start.byte, sourceRange.end.byte) : ''
      if (!bp) {
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
      const sourceRanges = await blueprintsSource.getSourceRanges(saltoElemErr.elemID)
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
        ...await blueprintsSource.getErrors(),
        validation: validateElements(resolvedElements),
      })
    }
    return {
      uid: workspaceConfig.value.uid,
      name: workspaceConfig.value.name,
      elements,
      state,
      envs,
      currentEnv,
      services,
      errors,
      hasErrors: async () => (await errors()).hasErrors(),
      servicesCredentials: async () => _.fromPairs(await Promise.all(services()
        .map(async service => [service, await config.get(`${currentEnv}/${CREDENTIALS_CONFIG}/${service}`)]))),
      servicesConfig: async () => _.fromPairs(await Promise.all(services()
        .map(async service => [service, await config.get(`${ADAPTERS_CONFIGS}/${service}`)]))),
      isEmpty: async (blueprintsOnly = false): Promise<boolean> => {
        const notConfig = (elem: Element): boolean => !elem.elemID.isConfig()
        const isBlueprintsSourceEmpty = _.isEmpty((await elements()).filter(notConfig))
        const isStateEmpty = _.isEmpty((await state().getAll()).filter(notConfig))
        return blueprintsOnly === true
          ? isBlueprintsSourceEmpty
          : isBlueprintsSourceEmpty && isStateEmpty
      },
      setBlueprints: blueprintsSource.setBlueprints,
      updateBlueprints: blueprintsSource.updateBlueprints,
      removeBlueprints: blueprintsSource.removeBlueprints,
      getSourceMap: blueprintsSource.getSourceMap,
      getSourceRanges: blueprintsSource.getSourceRanges,
      listBlueprints: blueprintsSource.listBlueprints,
      getBlueprint: blueprintsSource.getBlueprint,
      getElements: blueprintsSource.getElements,
      transformToWorkspaceError,
      transformError,
      getSourceFragment,
      getWorkspaceErrors: async (): Promise<ReadonlyArray<WorkspaceError<SaltoError>>> => {
        const resolvedErrors = await errors()
        return Promise.all(
          _.flatten(_.partition(
            [...resolvedErrors.parse, ...resolvedErrors.merge, ...resolvedErrors.validation],
            val => val.severity === 'Error'
          )).slice(0, MAX_ERROR_NUMBER).map(transformError)
        )
      },
      flush: async (): Promise<void> => {
        await state().flush()
        await blueprintsSource.flush()
      },
      clone: (): Promise<Workspace> => {
        const sources = _.mapValues(elementsSources, source =>
          ({ blueprints: source.blueprints.clone(), state: source.state }))
        return loadWorkspace(config, sources)
      },

      addService: async (service: string): Promise<void> => {
        const currentServices = services() || []
        if (currentServices.includes(service)) {
          throw new ServiceDuplicationError(service)
        }
        // TODO: verify this works!
        currentEnvConf().services = [...services(), service]
        await config.set(WORKSPACE_CONFIG, workspaceConfig)
      },
      updateServiceCredentials:
      async (service: string, credentials: Readonly<InstanceElement>): Promise<void> =>
        config.set(`${currentEnv}/${CREDENTIALS_CONFIG}/${service}`, credentials),
      updateServiceConfig:
      async (service: string, newConfig: Readonly<InstanceElement>): Promise<void> =>
        config.set(service, newConfig),
      addEnvironment: async (env: string): Promise<void> => {
        const currentEnvs = workspaceConfig.value.envs || []
        if (currentEnvs.map((e: EnvConfig) => e.name).includes(env)) {
          throw new EnvDuplicationError(env)
        }
        workspaceConfig.value.envs = [...currentEnvs, { name: env }]
        await config.set(WORKSPACE_CONFIG, workspaceConfig)
      },
      setCurrentEnv: async (env: string, persist?: boolean): Promise<void> => {
        if (!envs().includes(env)) {
          throw new UnknownEnvError(env)
        }
        preferences.value.currentEnv = env
        // TODO: think!
        if (persist === false) {
          await config.set(PREFERENCE_CONFIG, preferences)
        }
        blueprintsSource = multiEnvSource(_.mapValues(elementsSources, e => e.blueprints),
          currentEnv(), COMMON_ENV_PREFIX)
      },

      getStateRecency: async (): Promise<StateRecency> => {
        const staleStateThresholdMs = workspaceConfig.value.staleStateThresholdMinutes * 60 * 1000
        const date = await state().getUpdateDate()
        const status = (() => {
          if (date === null) {
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
  envs: EnviornmentsSources,
): Promise<Workspace> => {
  // TODO: validate we have single env + common?
  await config.set(WORKSPACE_CONFIG, new InstanceElement(WORKSPACE_CONFIG, workspaceConfigType,
    { uid, name, envs: [{ name: defaultEnvName }] }))
  await config.set(PREFERENCE_CONFIG, new InstanceElement(PREFERENCE_CONFIG,
    preferencesWorkspaceConfigType, { currentEnv: defaultEnvName }))
  return loadWorkspace(config, envs)
}
