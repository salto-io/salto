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
import uuidv4 from 'uuid/v4'
import { Element, SaltoError, SaltoElementError, ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { DetailedChange } from '../core/plan'
import { validateElements } from '../core/validator'
import { mkdirp, exists } from '../file'
import { SourceRange, ParseError, SourceMap } from '../parser/parse'
import { Config, dumpConfig, locateWorkspaceRoot, getConfigPath, completeConfig, saltoConfigType } from './config'
import Credentials, { adapterCredentials } from './credentials'
import State from './state'
import { localState } from './local/state'
import { blueprintsSource, BP_EXTENSION, BlueprintsSource, Blueprint, RoutingMode } from './blueprints/blueprints_source'
import { parseResultCache } from './cache'
import { localDirectoryStore } from './local/dir_store'
import { multiEnvSource } from './blueprints/mutil_env/multi_env_source'
import { Errors } from './errors'

const COMMON_ENV_PREFIX = ''
const log = logger(module)

class ExistingWorkspaceError extends Error {
  constructor() {
    super('existing salto workspace')
  }
}

class NotAnEmptyWorkspaceError extends Error {
  constructor(exsitingPathes: string[]) {
    super(`not an empty workspace. ${exsitingPathes.join('')} already exists.`)
  }
}

export type WorkspaceError<T extends SaltoError > = Readonly<T & {
  sourceFragments: SourceFragment[]
}>

export type SourceFragment = {
  sourceRange: SourceRange
  fragment: string
}

const ensureEmptyWorkspace = async (config: Config): Promise<void> => {
  if (await locateWorkspaceRoot(path.resolve(config.baseDir))) {
    throw new ExistingWorkspaceError()
  }
  const configPath = getConfigPath(config.baseDir)
  const shouldNotExist = [
    configPath,
    config.localStorage,
    config.stateLocation,
  ]
  const existenceMask = await Promise.all(shouldNotExist.map(exists))
  const existing = shouldNotExist.filter((_p, i) => existenceMask[i])
  if (existing.length > 0) {
    throw new NotAnEmptyWorkspaceError(existing)
  }
}

type MergedState = {
  readonly mergedElements: Element[]
  readonly errors: Errors
}

const loadBlueprintSource = (
  sourceBaseDir: string,
  localStorage: string,
  excludeDirs: string[] = []
): BlueprintsSource => {
  const blueprintsStore = localDirectoryStore(
    sourceBaseDir,
    `*${BP_EXTENSION}`,
    (dirParh: string) => !excludeDirs.includes(dirParh),
  )
  const cacheStore = localDirectoryStore(path.join(localStorage, '.cache'))
  return blueprintsSource(blueprintsStore, parseResultCache(cacheStore))
}

const loadMultiEnvSource = (config: Config): BlueprintsSource => {
  if (!config.currentEnv || _.isEmpty(config.envs)) {
    throw new Error('can not load a multi env source without envs and current env settings')
  }
  const activeEnv = config.envs.find(env => env.name === config.currentEnv)
  if (!activeEnv) {
    throw new Error('Unknown active env')
  }

  const sources = {
    ..._.fromPairs(config.envs.map(env =>
      [
        env.baseDir,
        loadBlueprintSource(
          path.resolve(config.baseDir, env.baseDir),
          path.resolve(config.localStorage, env.baseDir)
        ),
      ])),
    [COMMON_ENV_PREFIX]: loadBlueprintSource(
      config.baseDir,
      config.localStorage,
      _.values(config.envs.map(env => path.join(config.baseDir, env.baseDir)))
    ),
  }
  return multiEnvSource(sources, activeEnv.baseDir, COMMON_ENV_PREFIX)
}

export class Workspace {
  readonly state: State
  readonly credentials: Credentials
  private readonly blueprintsSource: BlueprintsSource
  private mergedStatePromise?: Promise<MergedState>

  constructor(public config: Config) {
    this.blueprintsSource = _.isEmpty(config.envs)
      ? loadBlueprintSource(config.baseDir, config.localStorage)
      : loadMultiEnvSource(config)
    this.state = localState(config.stateLocation)
    this.credentials = adapterCredentials(
      localDirectoryStore(path.resolve(config.localStorage, config.credentialsLocation))
    )
  }

  static async init(
    baseDir: string,
    workspaceName?: string,
    defaultEnvName = 'default'
  ): Promise<Workspace> {
    const absBaseDir = path.resolve(baseDir)
    const minimalConfig = {
      uid: uuidv4(),
      name: workspaceName || path.basename(absBaseDir),
      services: [],
      envs: [{
        name: defaultEnvName,
        baseDir: path.join('envs', defaultEnvName),
      }],
      currentEnv: defaultEnvName,
    }
    const config = completeConfig(absBaseDir, minimalConfig)
    // We want to make sure that *ALL* of the paths we are going to create
    // do not exist right now before writing anything to disk.
    await ensureEmptyWorkspace(config)
    await dumpConfig(absBaseDir, minimalConfig)
    await mkdirp(config.localStorage)
    return new Workspace(config)
  }

  private get mergedState(): Promise<MergedState> {
    const buildMergedState = async (): Promise<MergedState> => {
      const mergedElements = await this.blueprintsSource.getAll()
      mergedElements.push(saltoConfigType)
      return {
        mergedElements,
        errors: new Errors({
          ...await this.blueprintsSource.getErrors(),
          validation: validateElements(mergedElements),
        }),
      }
    }
    if (_.isUndefined(this.mergedStatePromise)) {
      this.mergedStatePromise = buildMergedState()
    }
    return this.mergedStatePromise as Promise<MergedState>
  }

  private resetMergedState(): void {
    this.mergedStatePromise = undefined
  }

  async isEmpty(blueprintsOnly = false): Promise<boolean> {
    const notConfig = (elem: Element): boolean => !elem.elemID.isConfig()
    const isBlueprintsSourceEmpty = _.isEmpty((await this.elements).filter(notConfig))
    const isStateEmpty = _.isEmpty((await this.state.getAll()).filter(notConfig))
    return blueprintsOnly === true
      ? isBlueprintsSourceEmpty
      : isBlueprintsSourceEmpty && isStateEmpty
  }

  get elements(): Promise<ReadonlyArray<Element>> {
    return this.mergedState.then(state => state.mergedElements)
  }

  get errors(): Promise<Errors> {
    return this.mergedState.then(state => state.errors)
  }

  hasErrors(): Promise<boolean> {
    return this.errors.then(errors => errors.hasErrors())
  }

  getSourceMap(filename: string): Promise<SourceMap> {
    return this.blueprintsSource.getSourceMap(filename)
  }

  getSourceRanges(elemID: ElemID): Promise<SourceRange[]> {
    return this.blueprintsSource.getSourceRanges(elemID)
  }

  async listBlueprints(): Promise<string[]> {
    return this.blueprintsSource.listBlueprints()
  }

  async getBlueprint(filename: string): Promise<Blueprint | undefined> {
    return this.blueprintsSource.getBlueprint(filename)
  }

  async setBlueprints(...blueprints: Blueprint[]): Promise<void> {
    this.resetMergedState()
    return this.blueprintsSource.setBlueprints(...blueprints)
  }

  async getElements(filename: string): Promise<Element[]> {
    return this.blueprintsSource.getElements(filename)
  }

  async removeBlueprints(...names: string[]): Promise<void> {
    this.resetMergedState()
    return this.blueprintsSource.removeBlueprints(...names)
  }

  async updateBlueprints(changes: DetailedChange[], mode?: RoutingMode): Promise<void> {
    this.resetMergedState()
    return this.blueprintsSource.update(changes, mode)
  }

  private async getSourceFragment(sourceRange: SourceRange): Promise<SourceFragment> {
    const bp = await this.blueprintsSource.getBlueprint(sourceRange.filename)
    const fragment = bp ? bp.buffer.substring(sourceRange.start.byte, sourceRange.end.byte) : ''
    if (!bp) {
      log.warn('failed to resolve source fragment for %o', sourceRange)
    }
    return {
      sourceRange,
      fragment,
    }
  }

  async transformToWorkspaceError<T extends SaltoElementError>(saltoElemErr: T):
  Promise<Readonly<WorkspaceError<T>>> {
    const sourceRanges = await this.blueprintsSource.getSourceRanges(saltoElemErr.elemID)
    const sourceFragments = await Promise.all(sourceRanges.map(sr => this.getSourceFragment(sr)))
    return {
      ...saltoElemErr,
      message: saltoElemErr.message,
      sourceFragments,
    }
  }

  private async transformParseError(error: ParseError): Promise<WorkspaceError<SaltoError>> {
    return {
      ...error,
      sourceFragments: [await this.getSourceFragment(error.subject)],
    }
  }

  async getWorkspaceErrors(): Promise<ReadonlyArray<WorkspaceError<SaltoError>>> {
    const wsErrors = await this.errors
    return Promise.all(_.flatten([
      wsErrors.parse.map(parseError => this.transformParseError(parseError)),
      wsErrors.merge.map(mergeError => this.transformToWorkspaceError(mergeError)),
      wsErrors.validation.map(validationError => this.transformToWorkspaceError(validationError)),
    ]))
  }

  async flush(): Promise<void> {
    await this.state.flush()
    await this.blueprintsSource.flush()
  }
}
