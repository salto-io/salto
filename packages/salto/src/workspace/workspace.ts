import _ from 'lodash'
import wu from 'wu'
import path from 'path'
import fs from 'async-file'
import readdirp from 'readdirp'
import { Element } from 'adapter-api'

import {
  SourceMap, parse, SourceRange, ParseResult,
} from '../parser/parse'

import { mergeElements } from '../core/merger'
import validateElements from '../core/validator'
import { DetailedChange } from '../core/plan'
import { ParseResultFSCache } from './cache'
import { getChangeLocations, updateBlueprintData } from './blueprint_update'

const CACHE_FOLDER = '.cache'
export type Blueprint = {
  buffer: string
  filename: string
  timestamp?: number
}


export type ParsedBlueprint = Blueprint & ParseResult

export type SaltoError = string
export interface ParsedBlueprintMap {
  [key: string]: ParsedBlueprint
}
export type ReadOnlySourceMap = ReadonlyMap<string, SourceRange[]>

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
  blueprintsFiles: string[],
): Promise<Blueprint[]> => {
  try {
    const filenames = blueprintsFiles.concat(await getBlueprintsFromDir(blueprintsDir))
    return Promise.all(filenames.map(async filename => ({
      filename: path.relative(blueprintsDir, filename),
      buffer: await fs.readFile(filename, 'utf8'),
      timestamp: (await fs.stat(filename)).mtimeMs,
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
  blueprintsDir: string,
): Promise<ParsedBlueprint[]> => {
  const cache = new ParseResultFSCache(path.join(blueprintsDir, CACHE_FOLDER))
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

const mergeSourceMaps = (bps: ReadonlyArray<ParsedBlueprint>): SourceMap => (
  bps.map(bp => bp.sourceMap).reduce((prev, curr) => {
    wu(curr.entries()).forEach(([k, v]) => {
      prev.set(k, (prev.get(k) || []).concat(v))
    })
    return prev
  }, new Map<string, SourceRange[]>())
)

type WorkspaceState = {
  readonly parsedBlueprints: ParsedBlueprintMap
  readonly sourceMap: ReadOnlySourceMap
  readonly elements: ReadonlyArray<Element>
  readonly errors: ReadonlyArray<SaltoError>
}

const createWorkspaceState = (blueprints: ReadonlyArray<ParsedBlueprint>): WorkspaceState => {
  const partialWorkspace = {
    parsedBlueprints: _.keyBy(blueprints, 'filename'),
    sourceMap: mergeSourceMaps(blueprints),
  }
  const errors = _.flatten(blueprints.map(bp => bp.errors)).map(e => e.detail)
  try {
    const elements = mergeElements(_.flatten(blueprints.map(bp => bp.elements)))
    return {
      ...partialWorkspace,
      elements,
      errors: [
        ...errors,
        ...validateElements(elements).map(e => e.message),
      ],
    }
  } catch (e) {
    return {
      ...partialWorkspace,
      elements: [],
      errors: [...errors, e.message],
    }
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
    blueprintsDir: string,
    blueprintsFiles: string[],
    useCache = true
  ): Promise<Workspace> {
    const bps = await loadBlueprints(blueprintsDir, blueprintsFiles)
    const parsedBlueprints = useCache
      ? parseBlueprintsWithCache(bps, blueprintsDir)
      : parseBlueprints(bps)
    return new Workspace(blueprintsDir, await parsedBlueprints)
  }

  constructor(
    public readonly baseDir: string,
    blueprints: ReadonlyArray<ParsedBlueprint>,
    readonly useCache: boolean = true
  ) {
    this.state = createWorkspaceState(blueprints)
    this.dirtyBlueprints = new Set<string>()
  }

  // Accessors into state
  get elements(): ReadonlyArray<Element> { return this.state.elements }
  get errors(): ReadonlyArray<SaltoError> { return this.state.errors }
  get parsedBlueprints(): ParsedBlueprintMap { return this.state.parsedBlueprints }
  get sourceMap(): ReadOnlySourceMap { return this.state.sourceMap }

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
    const cache = new ParseResultFSCache(path.join(this.baseDir, CACHE_FOLDER))
    await Promise.all(wu(this.dirtyBlueprints).map(async filename => {
      const bp = this.parsedBlueprints[filename]
      const filePath = path.join(this.baseDir, filename)
      if (bp === undefined) {
        await fs.delete(filePath)
      } else {
        await fs.mkdirp(path.dirname(filePath))
        await fs.writeFile(filePath, bp.buffer)
        if (this.useCache) {
          await cache.put({
            filename,
            lastModified: Date.now(),
          }, bp)
        }
      }
      this.dirtyBlueprints.delete(filename)
    }))
  }
}
