import _ from 'lodash'
import wu from 'wu'
import path from 'path'
import readdirp from 'readdirp'
import uuidv4 from 'uuid/v4'
import { types } from '@salto/lowerdash'
import { Element, ElemID, isInstanceElement, InstanceElement, SaltoError, SaltoElementError } from 'adapter-api'
import { logger } from '@salto/logging'
import { DefaultMap } from '@salto/lowerdash/dist/src/collections/map'
import { stat, mkdirp, readTextFile, rm, writeFile, exists, Stats } from '../file'
import { SourceMap, parse, SourceRange, ParseError, ParseResult } from '../parser/parse'
import { mergeElements, MergeError } from '../core/merger'
import { validateElements, ValidationError } from '../core/validator'
import { DetailedChange } from '../core/plan'
import { ParseResultFSCache } from './cache'
import { getChangeLocations, updateBlueprintData, getChangesToUpdate, BP_EXTENSION } from './blueprint_update'
import { Config, dumpConfig, locateWorkspaceRoot, getConfigPath, completeConfig, saltoConfigType } from './config'
import LocalState from './local/state'
import { State } from './state'

const log = logger(module)

export const CREDS_DIR = 'credentials'
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

export type Blueprint = {
  buffer: string
  filename: string
  timestamp?: number
}


export type WorkspaceError<T extends SaltoError > = Readonly<T & {
   sourceFragments: SourceFragment[]
}>

export interface ParsedBlueprint {
  filename: string
  elements: Element[]
  errors: ParseError[]
  timestamp?: number
  sourceMap?: SourceMap
  buffer?: string
}

export type ResolvedParsedBlueprint = ParsedBlueprint & {
  sourceMap: SourceMap
  buffer: string
}

export interface ParsedBlueprintMap {
  [key: string]: ParsedBlueprint
}

export const getBlueprintsFromDir = async (
  blueprintsDir: string,
): Promise<string[]> => {
  const entries = await readdirp.promise(blueprintsDir, {
    fileFilter: `*${BP_EXTENSION}`,
    directoryFilter: e => e.basename[0] !== '.',
  })
  return entries.map(e => e.fullPath)
}

const loadBlueprint = async (filename: string, blueprintsDir: string): Promise<Blueprint> => {
  const relFileName = path.isAbsolute(filename)
    ? path.relative(blueprintsDir, filename)
    : filename
  const absFileName = path.resolve(blueprintsDir, relFileName)
  return {
    filename: relFileName,
    buffer: await readTextFile(absFileName),
    timestamp: (await stat(absFileName) as Stats).mtimeMs,
  }
}

const loadBlueprints = async (
  blueprintsDir: string,
  credsDir: string,
  blueprintsFiles: string[],
): Promise<Blueprint[]> => {
  try {
    const filenames = [
      ...blueprintsFiles,
      ...await getBlueprintsFromDir(blueprintsDir),
      ...await getBlueprintsFromDir(credsDir),
    ]
    return Promise.all(filenames.map(filename => loadBlueprint(filename, blueprintsDir)))
  } catch (e) {
    throw Error(`Failed to load blueprint files: ${e.message}`)
  }
}

const getParseResult = async (
  bp: Blueprint,
  cacheFolder: string,
  workspaceFolder: string,
  useCache = true
): Promise<ParseResult> => {
  const cache = new ParseResultFSCache(cacheFolder, workspaceFolder)
  const key = { filename: bp.filename, lastModified: bp.timestamp || Date.now() }
  if (useCache) {
    const cachedParsedResult = await cache.get(key)
    if (cachedParsedResult) return cachedParsedResult
  }
  const result = parse(Buffer.from(bp.buffer), bp.filename)
  if (useCache) {
    await cache.put(key, result)
  }
  return result
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

const parseBlueprint = async (
  bp: Blueprint,
  cacheFolder: string,
  workspaceFolder: string,
  useCache = true,
  keepSource = false
): Promise<ParsedBlueprint> => {
  const parseResult = await getParseResult(bp, cacheFolder, workspaceFolder, useCache)
  return keepSource
    ? { ...bp, ...parseResult }
    : {
      timestamp: bp.timestamp,
      filename: bp.filename,
      elements: parseResult.elements,
      errors: parseResult.errors,
    }
}

export const parseBlueprints = async (
  blueprints: Blueprint[],
  cacheFolder: string,
  workspaceFolder: string,
  useCache = true,
  keepSource = false
): Promise<ParsedBlueprint[]> =>
  Promise.all(
    blueprints.map(bp => parseBlueprint(bp, cacheFolder, workspaceFolder, useCache, keepSource))
  )

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

export type SourceFragment = {
  sourceRange: SourceRange
  fragment: string
}

type WorkspaceState = {
  readonly parsedBlueprints: ParsedBlueprintMap
  readonly elements: ReadonlyArray<Element>
  readonly errors: Errors
  readonly elementsIndex: Record<string, string[]>
}

const createWorkspaceState = (blueprints: ReadonlyArray<ParsedBlueprint>): WorkspaceState => {
  log.info(`going to create new workspace state with ${blueprints.length} blueprints`)
  const partialWorkspace = {
    parsedBlueprints: _.keyBy(blueprints, 'filename'),
  }
  const parseErrors = _.flatten(blueprints.map(bp => bp.errors))
  const elements = [
    ..._.flatten(blueprints.map(bp => bp.elements)),
    saltoConfigType,
  ]
  const elementsIndex: Record<string, string[]> = {}
  blueprints.forEach(bp => bp.elements.forEach(e => {
    const key = e.elemID.getFullName()
    elementsIndex[key] = elementsIndex[key] || []
    elementsIndex[key] = _.uniq([...elementsIndex[key], bp.filename])
  }))
  const { merged: mergedElements, errors: mergeErrors } = mergeElements(elements)
  const validationErrors = validateElements(mergedElements)
  log.info(`found ${mergeErrors.length} merge errors and ${validationErrors.length} validation errors`)
  return {
    ...partialWorkspace,
    elementsIndex,
    elements: mergedElements,
    errors: new Errors({
      parse: Object.freeze(parseErrors),
      merge: mergeErrors,
      validation: validationErrors,
    }),
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
  private workspaceState: WorkspaceState
  private dirtyBlueprints: Set<string>

  /**
   * Load a collection of blueprint files as a workspace
   * @param blueprintsDir Base directory to load blueprints from
   * @param blueprintsFiles Paths to additional files (outside the blueprints dir) to include
   *   in the workspace
   */
  static async load(
    config: Config,
    useCache = true
  ): Promise<Workspace> {
    const bps = await loadBlueprints(
      config.baseDir,
      path.join(config.localStorage, CREDS_DIR),
      config.additionalBlueprints || []
    )
    const parsedBlueprints = parseBlueprints(bps, config.localStorage, config.baseDir, useCache)
    const ws = new Workspace(config, await parsedBlueprints)
    log.debug(`finished loading workspace with ${ws.elements.length} elements`)
    if (ws.hasErrors()) {
      const errors = await ws.getWorkspaceErrors()
      log.warn(`workspace ${ws.config.name} has ${errors.filter(e => e.severity === 'Error').length
      } workspace errors and ${errors.filter(e => e.severity === 'Warning').length} warnings`)
      errors.forEach(e => {
        log.warn(`\t${e.severity}: ${e.message}`)
      })
    }
    return ws
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
    return Workspace.load(config)
  }

  constructor(
    public config: Config,
    blueprints: ReadonlyArray<ParsedBlueprint>,
    readonly useCache: boolean = true,
    readonly state: State = new LocalState(config.stateLocation)
  ) {
    this.workspaceState = createWorkspaceState(blueprints)
    this.dirtyBlueprints = new Set<string>()
  }

  // Accessors into state
  get elements(): ReadonlyArray<Element> { return this.workspaceState.elements }
  get errors(): Errors { return this.workspaceState.errors }
  hasErrors(): boolean { return this.workspaceState.errors.hasErrors() }
  get parsedBlueprints(): ParsedBlueprintMap { return this.workspaceState.parsedBlueprints }
  get elementsIndex(): Record<string, string[]> { return this.workspaceState.elementsIndex }
  get configElements(): ReadonlyArray<InstanceElement> {
    return this.workspaceState.elements.filter(isInstanceElement).filter(e => e.elemID.isConfig())
  }

  async resolveParsedBlueprint(bp: ParsedBlueprint): Promise<ResolvedParsedBlueprint> {
    if (bp.buffer && bp.sourceMap) {
      return bp as ResolvedParsedBlueprint
    }
    const baseBP = bp.buffer ? bp : await loadBlueprint(bp.filename, this.config.baseDir)
    const resolvedBP = await parseBlueprint(
      baseBP as Blueprint,
      this.config.localStorage,
      this.config.baseDir,
      true,
      true
    )
    this.parsedBlueprints[bp.filename] = resolvedBP
    return resolvedBP as ResolvedParsedBlueprint
  }

  private getElementBlueprints(elemID: ElemID): ParsedBlueprint[] {
    const topLevelID = elemID.createTopLevelParentID()
    const bpNames = this.elementsIndex[topLevelID.parent.getFullName()] || []
    return bpNames.map(bpName => this.parsedBlueprints[bpName])
  }

  async getSourceRanges(elemID: ElemID): Promise<SourceRange[]> {
    const bps = this.getElementBlueprints(elemID)
    const sourceRanges = await Promise.all(
      bps.map(async bp => (
        await this.resolveParsedBlueprint(bp)).sourceMap.get(elemID.getFullName()) || [])
    )
    return _.flatten(sourceRanges)
  }

  private async resolveSourceFragment(sourceRange: SourceRange): Promise<SourceFragment> {
    const bp = await this.resolveParsedBlueprint(this.workspaceState.parsedBlueprints[
      sourceRange.filename])
    const bpString = bp.buffer
    const fragment = bpString.substring(sourceRange.start.byte, sourceRange.end.byte)
    return {
      sourceRange,
      fragment,
    }
  }

  async transformToWorkspaceError<T extends SaltoElementError>(saltoElemErr: T):
  Promise<Readonly<WorkspaceError<T>>> {
    const sourceRanges = await this.getSourceRanges(saltoElemErr.elemID)
    const sourceFragments = await Promise.all(
      sourceRanges.map(sr => this.resolveSourceFragment(sr))
    )
    return {
      ...saltoElemErr,
      message: saltoElemErr.message,
      sourceFragments,
    }
  }

  async getWorkspaceErrors(): Promise<ReadonlyArray<WorkspaceError<SaltoError>>> {
    const wsErrors = this.workspaceState.errors
    return Promise.all(_.flatten([
      wsErrors.parse.map(
        async (parseError: ParseError): Promise<WorkspaceError<SaltoError>> =>
          ({ ...parseError,
            sourceFragments: [await this.resolveSourceFragment(parseError.subject)] })
      ),
      wsErrors.merge.map(mergeError =>
        this.transformToWorkspaceError(mergeError)),
      wsErrors.validation.map(validationError =>
        this.transformToWorkspaceError(validationError)),
    ]))
  }

  private markDirty(names: string[]): void {
    names.forEach(name => this.dirtyBlueprints.add(name))
  }

  /**
   * Update workspace with changes to elements in the workspace
   *
   * @param changes The changes to apply
   */
  async updateBlueprints(...changes: DetailedChange[]): Promise<void> {
    const getBlueprintData = async (filename: string): Promise<string> => {
      const currentBlueprint = this.parsedBlueprints[filename]
      return currentBlueprint
        ? (await this.resolveParsedBlueprint(currentBlueprint)).buffer
        : ''
    }
    log.debug('going to calculate new blueprints data')

    const changesToUpdate = getChangesToUpdate(
      changes,
      this.elementsIndex
    )

    const changeSourceMaps = await Promise.all(_(changesToUpdate)
      .map('id')
      .map(elemID => this.getElementBlueprints(elemID))
      .flatten()
      .uniq()
      .map(async bp => (await this.resolveParsedBlueprint(bp)).sourceMap)
      .value())

    const mergedSourceMap = mergeSourceMaps(changeSourceMaps)
    const updatedBlueprints = (await Promise.all(
      _(changesToUpdate)
        .map(change => getChangeLocations(change, mergedSourceMap))
        .flatten()
        .groupBy(change => change.location.filename)
        .entries()
        .map(async ([filename, fileChanges]) => {
          try {
            const buffer = await updateBlueprintData(await getBlueprintData(filename), fileChanges)
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

  /**
   * Low level interface for updating/adding a specific blueprint to a workspace
   *
   * @param blueprints New blueprint or existing blueprint with new content
   */
  async setBlueprints(...blueprints: Blueprint[]): Promise<void> {
    log.debug(`going to parse ${blueprints.length} blueprints`)
    const parsed = await parseBlueprints(
      blueprints,
      this.config.localStorage,
      this.config.baseDir,
      true,
      true
    )

    const parsedMap = Object.assign(
      {},
      this.parsedBlueprints,
      ...parsed.map(bp => ({ [bp.filename]: bp }))
    )
    // remove empty blueprints
    const emptyBPFiles: string[] = parsed
      .filter(bp => _.isEmpty(bp.elements))
      .map(bp => bp.filename)
    log.debug(`empty bp files to remove : ${emptyBPFiles.join(', ')}`)
    const newParsedMap = _.omit(parsedMap, emptyBPFiles)
    // Mark changed blueprints as dirty
    this.markDirty(blueprints.map(bp => bp.filename))

    // Swap state
    this.workspaceState = createWorkspaceState(Object.values(newParsedMap))
  }

  /**
   * Remove specific blueprints from the workspace
   * @param names Names of the blueprints to remove
   */
  removeBlueprints(...names: string[]): void {
    log.debug(`removing ${names.length} blueprints`)
    const newParsedBlueprints = _(this.parsedBlueprints).omit(names).values().value()
    // Mark removed blueprints as dirty
    this.markDirty(names)
    // Swap state
    this.workspaceState = createWorkspaceState(newParsedBlueprints)
  }

  /**
   * Dump the current workspace state to the underlying persistent storage
   */
  async flush(): Promise<void> {
    const isNewConfig = (bp: ParsedBlueprint): boolean => (
      bp
      && bp.elements.length === 1
      && bp.elements[0].elemID.isConfig
      && bp.filename === path.join(CREDS_DIR, `${bp.elements[0].elemID.adapter}${BP_EXTENSION}`)
    )

    if (this.state.flush) {
      await this.state.flush()
    }
    const cache = new ParseResultFSCache(this.config.localStorage, this.config.baseDir)
    await Promise.all(wu(this.dirtyBlueprints).map(async filename => {
      const bp = this.parsedBlueprints[filename]
      const filePath = isNewConfig(bp)
        ? path.join(this.config.localStorage, filename)
        : path.join(this.config.baseDir, filename)
      if (bp === undefined) {
        await rm(filePath)
      } else {
        await mkdirp(path.dirname(filePath))
        await writeFile(filePath, (await this.resolveParsedBlueprint(bp)).buffer.toString())
        if (this.useCache) {
          await cache.put({
            filename: filePath,
            lastModified: Date.now(),
          }, await this.resolveParsedBlueprint(bp))
        }
      }
      this.dirtyBlueprints.delete(filename)
    }))
  }
}
