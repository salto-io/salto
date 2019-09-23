import _ from 'lodash'
import wu from 'wu'
import fs from 'async-file'
import readdirp from 'readdirp'
import { Element } from 'adapter-api'

import {
  SourceMap, parse, SourceRange, ParseResult,
} from '../parser/parse'
import { mergeElements } from '../core/merger'
import validateElements from '../core/validator'

export type Blueprint = {
  buffer: string
  filename: string
}
export type ParsedBlueprint = Blueprint & ParseResult

type SaltoError = string
interface ParsedBlueprintMap {
  [key: string]: ParsedBlueprint
}
type ReadOnlySourceMap = ReadonlyMap<string, SourceRange[]>

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
      filename,
      buffer: await fs.readFile(filename, 'utf8'),
    })))
  } catch (e) {
    throw Error(`Failed to load blueprint files: ${e.message}`)
  }
}

export const parseBlueprints = (blueprints: Blueprint[]): Promise<ParsedBlueprint[]> =>
  Promise.all(blueprints.map(async bp => ({
    ...bp,
    ...(await parse(Buffer.from(bp.buffer), bp.filename)),
  })))

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
  static async load(blueprintsDir: string, blueprintsFiles: string[]): Promise<Workspace> {
    const bps = await loadBlueprints(blueprintsDir, blueprintsFiles)
    const parsedBlueprints = await parseBlueprints(bps)
    return new Workspace(blueprintsDir, parsedBlueprints)
  }

  constructor(public readonly baseDir: string, blueprints: ReadonlyArray<ParsedBlueprint>) {
    this.state = createWorkspaceState(blueprints)
    this.dirtyBlueprints = new Set<string>()
  }

  // Accessors into state
  get elements(): ReadonlyArray<Element> { return this.state.elements }
  get errors(): ReadonlyArray<SaltoError> { return this.state.errors }
  get parsedBlueprints(): ParsedBlueprintMap { return this.state.parsedBlueprints }
  get sourceMap(): ReadOnlySourceMap { return this.state.sourceMap }

  /**
   * Low level interface for updating/adding a specific blueprint to a workspace
   *
   * @param newBlueprints New blueprint or existing blueprint with new content
   * @returns A new workspace with the new content
   */
  async setBlueprints(...newBlueprints: Blueprint[]): Promise<void> {
    const parsed = await parseBlueprints(newBlueprints)
    const newParsedMap = _.merge(
      {},
      this.parsedBlueprints,
      ...parsed.map(bp => ({ [bp.filename]: bp })),
    )
    // Mark changed blueprints as dirty
    parsed.forEach(bp => this.dirtyBlueprints.add(bp.filename))
    // Swap state
    this.state = createWorkspaceState(_.values(newParsedMap))
  }

  /**
   * Remove specific blueprints from the workspace
   * @param names Names of the blueprints to remove
   * @returns A new workspace without the blueprints that were removed
   */
  removeBlueprints(...names: string[]): void {
    const newParsedBlueprints = _(this.parsedBlueprints).omit(names).values().value()
    // Mark removed blueprints as dirty
    names.forEach(name => this.dirtyBlueprints.add(name))
    // Swap state
    this.state = createWorkspaceState(newParsedBlueprints)
  }

  /**
   * Dump the current workspace state to the underlying persistent storage
   */
  async flush(): Promise<void> {
    // Write all dirty blueprints to filesystem
    await Promise.all(wu(this.dirtyBlueprints.values()).map(filename => {
      const bp = this.parsedBlueprints[filename]
      if (bp === undefined) {
        // Blueprint was removed
        return fs.delete(filename)
      }
      return fs.writeFile(filename, bp.buffer)
    }))
    // Clear dirty list
    this.dirtyBlueprints.clear()
  }
}
