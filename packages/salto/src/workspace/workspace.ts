import _ from 'lodash'
import path from 'path'
import uuidv4 from 'uuid/v4'
import { Element, SaltoError, SaltoElementError, ElemID } from 'adapter-api'
import { logger } from '@salto/logging'
import { types } from '@salto/lowerdash'
import { DetailedChange } from '../core/plan'
import { MergeError, mergeElements } from '../core/merger'
import { ValidationError, validateElements } from '../core/validator'
import { mkdirp, exists } from '../file'
import { SourceRange, ParseError, SourceMap } from '../parser/parse'
import { Config, dumpConfig, locateWorkspaceRoot, getConfigPath, completeConfig, saltoConfigType } from './config'
import Credentials, { adapterCredentials } from './credentials'
import State from './state'
import { localState } from './local/state'
import { blueprintsSource, BP_EXTENSION, BlueprintsSource, Blueprint } from './blueprints/blueprints_source'
import { parseResultCache } from './cache'
import { localDirectoryStore } from './local/dir_store'

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

export class Errors extends types.Bean<Readonly<{
  parse: ReadonlyArray<ParseError>
  merge: ReadonlyArray<MergeError>
  validation: ReadonlyArray<ValidationError>
}>> {
  hasErrors(): boolean {
    return [this.parse, this.merge, this.validation].some(errors => errors.length > 0)
  }

  strings(): ReadonlyArray<string> {
    return [
      ...this.parse.map(error => error.detail),
      ...this.merge.map(error => error.error),
      ...this.validation.map(error => error.error),
    ]
  }
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

export class Workspace {
  readonly state: State
  readonly credentials: Credentials
  private readonly blueprintsSource: BlueprintsSource
  private mergedState?: Promise<MergedState>


  constructor(public config: Config) {
    const blueprintsStore = localDirectoryStore(config.baseDir, `*${BP_EXTENSION}`)
    const cacheStore = localDirectoryStore(path.join(config.localStorage, '.cache'))
    this.blueprintsSource = blueprintsSource(blueprintsStore, parseResultCache(cacheStore))
    this.state = localState(config.stateLocation)
    this.credentials = adapterCredentials(localDirectoryStore(path.join(config.localStorage, 'credentials')))
  }

  static async init(baseDir: string, workspaceName?: string): Promise<Workspace> {
    const absBaseDir = path.resolve(baseDir)
    const minimalConfig = {
      uid: uuidv4(),
      name: workspaceName || path.basename(absBaseDir),
      services: [],
    }
    const config = completeConfig(absBaseDir, minimalConfig)
    // We want to make sure that *ALL* of the paths we are going to create
    // do not exist right now before writing anything to disk.
    await ensureEmptyWorkspace(config)
    await dumpConfig(absBaseDir, minimalConfig)
    await mkdirp(config.localStorage)
    return new Workspace(config)
  }

  async isEmpty(): Promise<boolean> {
    const notConfig = (elem: Element): boolean => !elem.elemID.isConfig()
    return _.isEmpty((await this.elements).filter(notConfig))
    && _.isEmpty((await this.state.getAll()).filter(notConfig))
  }

  private initMergedState(): void {
    const buildMergedState = async (): Promise<MergedState> => {
      const { merged: mergedElements, errors: mergeErrors } = mergeElements(
        await this.blueprintsSource.getAll()
      )
      mergedElements.push(saltoConfigType)
      return {
        mergedElements,
        errors: new Errors({
          parse: Object.freeze(await this.blueprintsSource.getParseErrors()),
          merge: mergeErrors,
          validation: validateElements(mergedElements),
        }),
      }
    }
    if (_.isUndefined(this.mergedState)) {
      this.mergedState = buildMergedState()
    }
  }

  get elements(): Promise<ReadonlyArray<Element>> {
    this.initMergedState()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.mergedState!.then(state => state.mergedElements)
  }

  get errors(): Promise<Errors> {
    this.initMergedState()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.mergedState!.then(state => state.errors)
  }

  hasErrors(): Promise<boolean> {
    this.initMergedState()
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
    this.mergedState = undefined
    return this.blueprintsSource.setBlueprints(...blueprints)
  }

  async removeBlueprints(...names: string[]): Promise<void> {
    this.mergedState = undefined
    return this.blueprintsSource.removeBlueprints(...names)
  }

  async getElements(filename: string): Promise<Element[]> {
    return this.blueprintsSource.getElements(filename)
  }

  async updateBlueprints(...changes: DetailedChange[]): Promise<void> {
    this.mergedState = undefined
    return this.blueprintsSource.update(...changes)
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
