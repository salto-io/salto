import _ from 'lodash'
import path from 'path'
import uuidv4 from 'uuid/v4'
import { Element, ElemID, SaltoError, SaltoElementError } from 'adapter-api'
import { logger } from '@salto/logging'
import { DefaultMap } from '@salto/lowerdash/dist/src/collections/map'
import { mkdirp, exists } from '../file'
import { SourceMap, parse, SourceRange, ParseError, ParseResult } from '../parser/parse'
import { DetailedChange } from '../core/plan'
import { ParseResultCache } from './cache'
import { getChangeLocations, updateBlueprintData, getChangesToUpdate } from './blueprint_update'
import { Config, dumpConfig, locateWorkspaceRoot, getConfigPath, completeConfig } from './config'
import Credentials from './credentials'
import { localCredentials } from './local/credentials'
import State from './state'
import { localState } from './local/state'
import BlueprintsStore, { Blueprint } from './blueprints_store'
import { localBlueprintsStore } from './local/blueprints_store'
import {
  BlueprintsState, ParsedBlueprintMap, blueprintState, ParsedBlueprint, Errors,
} from './blueprints_state'
import { localParseResultCache } from './local/cache'

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

/**
 * The Workspace class exposes the content of a collection (usually a directory) of blueprints
 * in the form of Elements.
 *
 * Changes to elements represented in the workspace should be updated in the workspace through
 * one of the update methods and eventually flushed to persistent storage with "flush"
 *
 * Note that the workspace assumes users wait for operations to finish before another operation
 * is started, calling update / flush before another update / flush is finished will operate on
 * an out of date workspace and will probably lead to undesired behavior
 */
export class Workspace {
  readonly state: State
  readonly credentials: Credentials
  readonly blueprintsStore: BlueprintsStore
  private cache: ParseResultCache
  private blueprintsState: Promise<BlueprintsState>

  /**
   * Load a collection of blueprint files as a workspace
   * @param blueprintsDir Base directory to load blueprints from
   * @param blueprintsFiles Paths to additional files (outside the blueprints dir) to include
   *   in the workspace
   */
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

  private async buildBlueprintsState(newBps: Blueprint[], current: ParsedBlueprintMap):
  Promise<BlueprintsState> {
    log.debug(`going to parse ${newBps.length} blueprints`)
    const newParsed = _.keyBy(await this.parseBlueprints(newBps), parsed => parsed.filename)
    const allParsed = _.omitBy({ ...current, ...newParsed }, parsed => _.isEmpty(parsed.elements))
    return blueprintState(Object.values(allParsed))
  }

  constructor(public config: Config) {
    this.blueprintsStore = localBlueprintsStore(config.baseDir)
    this.state = localState(config.stateLocation)
    this.credentials = localCredentials(path.join(config.localStorage, 'credentials'))
    this.cache = localParseResultCache(path.join(this.config.localStorage, '.cache'))

    const readAllBps = async (blueprintsStore: BlueprintsStore):
    Promise<Blueprint[]> => Promise.all((await blueprintsStore.list())
      .map(async filename => this.blueprintsStore.get(filename))) as Promise<Blueprint[]>
    this.blueprintsState = readAllBps(this.blueprintsStore)
      .then(bps => this.buildBlueprintsState(bps, {}))
  }

  async isEmpty(): Promise<boolean> {
    const notConfig = (elem: Element): boolean => !elem.elemID.isConfig()
    return _.isEmpty((await this.elements).filter(notConfig))
    && _.isEmpty((await this.state.getAll()).filter(notConfig))
  }

  // Accessors into blueprint state
  get elements(): Promise<ReadonlyArray<Element>> {
    return this.blueprintsState.then(ws => ws.elements)
  }

  get errors(): Promise<Errors> {
    return this.blueprintsState.then(ws => ws.errors)
  }

  get parsedBlueprints(): Promise<ParsedBlueprintMap> {
    return this.blueprintsState.then(ws => ws.parsedBlueprints)
  }

  private get elementsIndex(): Promise<Record<string, string[]>> {
    return this.blueprintsState.then(ws => ws.elementsIndex)
  }

  hasErrors(): Promise<boolean> {
    return this.blueprintsState.then(ws => ws.errors.hasErrors())
  }

  private async getElementBlueprints(elemID: ElemID): Promise<string[]> {
    const topLevelID = elemID.createTopLevelParentID()
    const elementsIndex = await this.elementsIndex
    return elementsIndex[topLevelID.parent.getFullName()] || []
  }

  async getSourceMap(parsedBp: ParsedBlueprint): Promise<SourceMap> {
    const { filename } = parsedBp
    const cachedParsedResult = await this.cache.get({ filename, lastModified: parsedBp.timestamp })
    if (_.isUndefined(cachedParsedResult)) {
      log.warn('expected to find source map for filename %s, going to re-parse', filename)
      const buffer = (await this.blueprintsStore.get(filename))?.buffer
      if (_.isUndefined(buffer)) {
        log.error('failed to find %s in blueprint store', filename)
        return new Map<string, SourceRange[]>()
      }
      return (await this.parseBlueprint({ filename, buffer })).sourceMap
    }
    return cachedParsedResult.sourceMap
  }

  async getSourceRanges(elemID: ElemID): Promise<SourceRange[]> {
    const bps = await this.getElementBlueprints(elemID)
    const parsedBlueprints = await this.parsedBlueprints
    const sourceRanges = await Promise.all(bps
      .map(async bp =>
        (await this.getSourceMap(parsedBlueprints[bp])).get(elemID.getFullName())
        || []))
    return _.flatten(sourceRanges)
  }

  private async getSourceFragment(sourceRange: SourceRange): Promise<SourceFragment> {
    const bp = await this.blueprintsStore.get(sourceRange.filename)
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
    const sourceRanges = await this.getSourceRanges(saltoElemErr.elemID)
    const sourceFragments = await Promise.all(sourceRanges.map(sr => this.getSourceFragment(sr)))
    return {
      ...saltoElemErr,
      message: saltoElemErr.message,
      sourceFragments,
    }
  }

  async getWorkspaceErrors(): Promise<ReadonlyArray<WorkspaceError<SaltoError>>> {
    const wsErrors = await this.errors
    return Promise.all(_.flatten([
      wsErrors.parse.map(
        async (parseError: ParseError): Promise<WorkspaceError<SaltoError>> =>
          ({ ...parseError,
            sourceFragments: [await this.getSourceFragment(parseError.subject)] })
      ),
      wsErrors.merge.map(mergeError =>
        this.transformToWorkspaceError(mergeError)),
      wsErrors.validation.map(validationError =>
        this.transformToWorkspaceError(validationError)),
    ]))
  }

  /**
   * Update workspace with changes to elements in the workspace
   *
   * @param changes The changes to apply
   */
  async updateBlueprints(...changes: DetailedChange[]): Promise<void> {
    const getBlueprintData = async (filename: string): Promise<string> => {
      const bp = await this.blueprintsStore.get(filename)
      return bp ? bp.buffer : ''
    }

    const mergeSourceMaps = (sourceMaps: SourceMap[]): SourceMap => {
      const result = new DefaultMap<string, SourceRange[]>(() => [])
      sourceMaps.forEach(sourceMap => {
        sourceMap.forEach((ranges, key) => {
          result.get(key).push(...ranges)
        })
      })
      return result
    }

    log.debug('going to calculate new blueprints data')
    const changesToUpdate = getChangesToUpdate(changes, await this.elementsIndex)
    const bps = _(await Promise.all(changesToUpdate
      .map(change => change.id)
      .map(elemID => this.getElementBlueprints(elemID))))
      .flatten().uniq().value()
    const parsedBlueprints = await this.parsedBlueprints
    const changeSourceMaps = await Promise.all(bps
      .map(async bp => this.getSourceMap(parsedBlueprints[bp])))

    const mergedSourceMap = mergeSourceMaps(changeSourceMaps)
    const updatedBlueprints = (await Promise.all(
      _(changesToUpdate)
        .map(change => getChangeLocations(change, mergedSourceMap))
        .flatten()
        .groupBy(change => change.location.filename)
        .entries()
        .map(async ([filename, fileChanges]) => {
          try {
            const buffer = updateBlueprintData(await getBlueprintData(filename), fileChanges)
            return { filename, buffer }
          } catch (e) {
            log.error('failed to update blueprint %s with %o changes due to: %o',
              filename, fileChanges, e)
            return undefined
          }
        })
        .value()
    )).filter(b => b !== undefined) as Blueprint[]

    log.debug('going to set the new blueprints')
    return this.setBlueprints(...updatedBlueprints)
  }

  async getBlueprint(name: string): Promise<Blueprint | undefined> {
    return this.blueprintsStore.get(name)
  }

  /**
   * Low level interface for updating/adding a specific blueprint to a workspace
   *
   * @param blueprints New blueprint or existing blueprint with new content
   */
  async setBlueprints(...blueprints: Blueprint[]): Promise<void> {
    await Promise.all(blueprints.map(bp => this.blueprintsStore.set(bp)))
    // Swap state
    this.blueprintsState = this.buildBlueprintsState(blueprints, await this.parsedBlueprints)
  }

  /**
   * Remove specific blueprints from the workspace
   * @param names Names of the blueprints to remove
   */
  async removeBlueprints(...names: string[]): Promise<void> {
    await Promise.all(names.map(name => this.blueprintsStore.delete(name)))
    // Swap state
    this.blueprintsState = this.buildBlueprintsState(names
      .map(filename => ({ filename, buffer: '' })), await this.parsedBlueprints)
  }

  private async parseBlueprint(bp: Blueprint): Promise<ParseResult> {
    const key = { filename: bp.filename, lastModified: bp.timestamp || Date.now() }
    let parseResult = await this.cache.get(key)
    if (parseResult === undefined) {
      parseResult = parse(Buffer.from(bp.buffer), bp.filename)
      await this.cache.put(key, parseResult)
    }
    return parseResult
  }

  private async parseBlueprints(blueprints: Blueprint[]): Promise<ParsedBlueprint[]> {
    return Promise.all(
      blueprints.map(bp => this.parseBlueprint(bp).then(parseResult => ({
        timestamp: bp.timestamp || Date.now(),
        filename: bp.filename,
        elements: parseResult.elements,
        errors: parseResult.errors,
      })))
    )
  }
}
