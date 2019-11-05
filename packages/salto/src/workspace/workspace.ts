import _ from 'lodash'
import wu from 'wu'
import path from 'path'
import readdirp from 'readdirp'
import uuidv4 from 'uuid/v4'
import { collections, types } from '@salto/lowerdash'
import { Element } from 'adapter-api'
import { stat, mkdirp, readTextFile, rm, writeTextFile, exists, Stats } from '../file'
import { SourceMap, parse, SourceRange, ParseResult, ParseError } from '../parser/parse'
import { mergeElements, MergeError } from '../core/merger'
import { validateElements, ValidationError } from '../core/validator'
import { DetailedChange } from '../core/plan'
import { ParseResultFSCache } from './cache'
import { getChangeLocations, updateBlueprintData } from './blueprint_update'
import {
  Config, dumpConfig, locateWorkspaceRoot, getConfigPath, completeConfig, saltoConfigType,
} from './config'

const { DefaultMap } = collections.map

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

export type WorkspaceErrorSeverity = 'Error' | 'Warning'

export type WorkspaceError = Readonly<{
   sourceFragments: SourceFragment[]
   error: string
   severity: WorkspaceErrorSeverity
   cause?: ParseError | ValidationError | MergeError
}>

export type ParsedBlueprint = Blueprint & ParseResult

export interface ParsedBlueprintMap {
  [key: string]: ParsedBlueprint
}

const getBlueprintsFromDir = async (
  blueprintsDir: string,
): Promise<string[]> => {
  const entries = await readdirp.promise(blueprintsDir, {
    fileFilter: '*.bp',
    directoryFilter: e => e.basename[0] !== '.',
  })
  return entries.map(e => e.fullPath)
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
    return Promise.all(filenames.map(async filename => ({
      filename: path.relative(blueprintsDir, filename),
      buffer: await readTextFile(filename),
      timestamp: (await stat(filename) as Stats).mtimeMs,
    })))
  } catch (e) {
    throw Error(`Failed to load blueprint files: ${e.message}`)
  }
}

const parseBlueprint = async (bp: Blueprint): Promise<ParsedBlueprint> => ({
  ...bp,
  ...await parse(Buffer.from(bp.buffer), bp.filename),
})

export const parseBlueprints = async (blueprints: Blueprint[]): Promise<ParsedBlueprint[]> =>
  Promise.all(blueprints.map(parseBlueprint))


const parseBlueprintsWithCache = (
  blueprints: Blueprint[],
  cacheFolder: string,
  workspaceFolder: string
): Promise<ParsedBlueprint[]> => {
  const cache = new ParseResultFSCache(cacheFolder, workspaceFolder)
  return Promise.all(blueprints.map(async bp => {
    if (bp.timestamp === undefined) return parseBlueprint(bp)
    const key = {
      filename: bp.filename,
      lastModified: bp.timestamp,
    }
    const cachedParseResult = await cache.get(key)
    if (cachedParseResult === undefined) {
      const parsedBP = await parseBlueprint(bp)
      await cache.put(key, parsedBP)
      return parsedBP
    }
    return { ...bp, ...cachedParseResult }
  }))
}

const mergeSourceMaps = (bps: ReadonlyArray<ParsedBlueprint>): SourceMap => {
  const result = new DefaultMap<string, SourceRange[]>(() => [])
  bps.forEach(bp => {
    const { sourceMap } = bp
    sourceMap.forEach((ranges, key) => {
      result.get(key).push(...ranges)
    })
  })
  return result
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

export type SourceFragment = {
  sourceRange: SourceRange
  fragment: string
}


type WorkspaceState = {
  readonly parsedBlueprints: ParsedBlueprintMap
  readonly sourceMap: SourceMap
  readonly elements: ReadonlyArray<Element>
  readonly errors: Errors
}

const createWorkspaceState = (blueprints: ReadonlyArray<ParsedBlueprint>): WorkspaceState => {
  const partialWorkspace = {
    parsedBlueprints: _.keyBy(blueprints, 'filename'),
    sourceMap: mergeSourceMaps(blueprints),
  }
  const parseErrors = _.flatten(blueprints.map(bp => bp.errors))
  const elements = [
    ..._.flatten(blueprints.map(bp => bp.elements)),
    saltoConfigType,
  ]
  const { merged: mergedElements, errors: mergeErrors } = mergeElements(elements)
  const validationErrors = validateElements(mergedElements)
  return {
    ...partialWorkspace,
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
  const existanceMask = await Promise.all(shouldNotExist.map(exists))
  const existing = shouldNotExist.filter((_p, i) => existanceMask[i])
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
  private state: WorkspaceState
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
    const parsedBlueprints = useCache
      ? parseBlueprintsWithCache(bps, config.localStorage, config.baseDir)
      : parseBlueprints(bps)
    return new Workspace(config, await parsedBlueprints)
  }

  static async init(baseDir: string, workspaceName?: string): Promise<Workspace> {
    const absBaseDir = path.resolve(baseDir)
    const minimalConfig = {
      uid: uuidv4(),
      name: workspaceName || path.basename(absBaseDir),
    }
    const config = completeConfig(absBaseDir, minimalConfig)
    // We want to make sure that *ALL* of the pathes we are going to create
    // do not exist right now before writing anything to disk.
    await ensureEmptyWorkspace(config)
    await dumpConfig(absBaseDir, minimalConfig)
    await mkdirp(config.localStorage)
    return Workspace.load(config)
  }

  constructor(
    public config: Config,
    blueprints: ReadonlyArray<ParsedBlueprint>,
    readonly useCache: boolean = true
  ) {
    this.state = createWorkspaceState(blueprints)
    this.dirtyBlueprints = new Set<string>()
  }

  // Accessors into state
  get elements(): ReadonlyArray<Element> { return this.state.elements }
  get errors(): Errors { return this.state.errors }
  hasErrors(): boolean { return this.state.errors.hasErrors() }
  get parsedBlueprints(): ParsedBlueprintMap { return this.state.parsedBlueprints }
  get sourceMap(): SourceMap { return this.state.sourceMap }

  private resolveSourceFragment(sourceRange: SourceRange): SourceFragment {
    const bpString = this.state.parsedBlueprints[sourceRange.filename].buffer
    const fragment = bpString.substring(sourceRange.start.byte, sourceRange.end.byte)
    return {
      sourceRange,
      fragment,
    }
  }

  getWorkspaceErrors(): ReadonlyArray<WorkspaceError> {
    const wsErrors = this.state.errors
    return [
      ...wsErrors.parse.map((pe: ParseError): WorkspaceError =>
        ({
          sourceFragments: [this.resolveSourceFragment(pe.subject)],
          error: pe.detail,
          severity: 'Error',
          cause: pe,
        })),
      ...wsErrors.merge.map((me: MergeError): WorkspaceError => {
        const sourceRanges = this.sourceMap.get(me.elemID.getFullName()) || []
        const sourceFragments = sourceRanges.map(sr => this.resolveSourceFragment(sr))
        return {
          sourceFragments,
          error: me.error,
          severity: 'Error',
          cause: me,
        }
      }),
      ...wsErrors.validation.map((ve: ValidationError): WorkspaceError => {
        const sourceRanges = this.sourceMap.get(ve.elemID.getFullName()) || []
        const sourceFragments = sourceRanges.map(sr => this.resolveSourceFragment(sr))
        return {
          sourceFragments,
          error: ve.error,
          severity: 'Warning',
          cause: ve,
        }
      }),
    ]
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
    const getBlueprintData = (filename: string): string => {
      const currentBlueprint = this.parsedBlueprints[filename]
      return currentBlueprint ? currentBlueprint.buffer : ''
    }

    const updatedBlueprints: Blueprint[] = await Promise.all(
      _(changes)
        .map(change => getChangeLocations(change, this.sourceMap))
        .flatten()
        .groupBy(change => change.location.filename)
        .entries()
        .map(async ([filename, fileChanges]) => ({
          filename,
          buffer: await updateBlueprintData(getBlueprintData(filename), fileChanges),
        }))
        .value()
    )
    return this.setBlueprints(...updatedBlueprints)
  }

  /**
   * Low level interface for updating/adding a specific blueprint to a workspace
   *
   * @param blueprints New blueprint or existing blueprint with new content
   */
  async setBlueprints(...blueprints: Blueprint[]): Promise<void> {
    const parsed = await parseBlueprints(blueprints)
    const newParsedMap = Object.assign(
      {},
      this.parsedBlueprints,
      ...parsed.map(bp => ({ [bp.filename]: bp })),
    )
    // Mark changed blueprints as dirty
    this.markDirty(blueprints.map(bp => bp.filename))
    // Swap state
    this.state = createWorkspaceState(Object.values(newParsedMap))
  }

  /**
   * Remove specific blueprints from the workspace
   * @param names Names of the blueprints to remove
   */
  removeBlueprints(...names: string[]): void {
    const newParsedBlueprints = _(this.parsedBlueprints).omit(names).values().value()
    // Mark removed blueprints as dirty
    this.markDirty(names)
    // Swap state
    this.state = createWorkspaceState(newParsedBlueprints)
  }

  /**
   * Dump the current workspace state to the underlying persistent storage
   */
  async flush(): Promise<void> {
    const isNewConfig = (bp: ParsedBlueprint): boolean => (
      bp
      && bp.elements.length === 1
      && bp.elements[0].elemID.isConfig
      && bp.filename === path.join(CREDS_DIR, `${bp.elements[0].elemID.adapter}.bp`)
    )

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
        await writeTextFile(filePath, bp.buffer.toString())
        if (this.useCache) {
          await cache.put({
            filename: filePath,
            lastModified: Date.now(),
          }, bp)
        }
      }
      this.dirtyBlueprints.delete(filename)
    }))
  }
}
