import _ from 'lodash'
import wu from 'wu'
import fs from 'async-file'
import readdirp from 'readdirp'
import { Element } from 'adapter-api'

import {
  SourceMap, ParseError, parse, SourceRange,
} from '../parser/parse'
import { mergeElements } from '../core/merger'
import validateElements from '../core/validator'
import { DetailedChange } from '../core/plan'

export interface Blueprint {
  buffer: string
  filename: string
}

export interface ParsedBlueprint extends Blueprint {
  elements: Element[]
  errors: ParseError[]
  sourceMap: SourceMap
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

const mergeSourceMaps = (bps: ParsedBlueprint[]): SourceMap => (
  bps.map(bp => bp.sourceMap).reduce((prev, curr) => {
    wu(curr.entries()).forEach(([k, v]) => {
      prev.set(k, (prev.get(k) || []).concat(v))
    })
    return prev
  }, new Map<string, SourceRange[]>())
)

type SaltoError = string
interface ParsedBlueprintMap {
  [key: string]: ParsedBlueprint
}

/**
 * The Workspace class exposes the content of a collection (usually a directory) of blueprints
 * in the form of Elements.
 *
 * Changes to elements represented in the workspace should be updated in the workspace through
 * one of the update methods and eventually flushed to persistent storage with "flush"
 *
 * Note that after a workspace is updated it is no longer valid, only the new workspace returned
 * from the update function should be used
 */
export class Workspace {
  parsedBlueprints: ParsedBlueprintMap
  sourceMap: SourceMap
  elements: Element[]
  errors: SaltoError[]

  constructor(
    public baseDir: string,
    blueprints: ParsedBlueprint[],
    private dirtyBlueprints: string[] = [],
  ) {
    this.parsedBlueprints = _.keyBy(blueprints, 'filename')
    this.errors = _.flatten(blueprints.map(bp => bp.errors)).map(e => e.detail)
    this.sourceMap = mergeSourceMaps(blueprints)
    try {
      this.elements = mergeElements(_.flatten(blueprints.map(bp => bp.elements)))
      this.errors.push(...validateElements(this.elements).map(e => e.message))
    } catch (e) {
      this.elements = []
      this.errors.push(e.message)
    }
  }

  /**
   * Update elements stored in this workspace
   * @param changes Change to apply to elements stored in this workspace
   * @returns A new workspace with updated elements
   */
  updateElements(_changes: DetailedChange[]): Workspace {
    // TODO: implement this interface to update existing blueprints
    return this
  }

  /**
   * Low level interface for updating/adding a specific blueprint to a workspace
   *
   * @param newBlueprints New blueprint or existing blueprint with new content
   * @returns A new workspace with the new content
   */
  async updateBlueprints(...newBlueprints: Blueprint[]): Promise<Workspace> {
    const parsed = await parseBlueprints(newBlueprints)
    const newParsedMap = _.merge(
      {},
      this.parsedBlueprints,
      ...parsed.map(bp => ({ [bp.filename]: bp })),
    )
    const dirty = this.dirtyBlueprints.concat(parsed.map(bp => bp.filename))
    return new Workspace(this.baseDir, _.values(newParsedMap), dirty)
  }

  /**
   * Remove specific blueprints from the workspace
   * @param names Names of the blueprints to remove
   * @returns A new workspace without the blueprints that were removed
   */
  removeBlueprints(...names: string[]): Workspace {
    return new Workspace(
      this.baseDir,
      _(this.parsedBlueprints).omit(names).values().value(),
      this.dirtyBlueprints.concat(names)
    )
  }

  /**
   * Dump the current workspace state to the underlying persistent storage
   */
  async flush(): Promise<void> {
    // Write all dirty blueprints to filesystem
    await Promise.all(this.dirtyBlueprints.map(filename => {
      const bp = this.parsedBlueprints[filename]
      if (bp === undefined) {
        // Blueprint was removed
        return fs.delete(filename)
      }
      return fs.writeFile(filename, bp.buffer)
    }))
    // Clear dirty list
    this.dirtyBlueprints = []
  }
}

/**
 * Load a collection of blueprint files as a workspace
 * @param blueprintsDir Base directory to load blueprints from
 * @param blueprintsFiles Paths to additional files (outside the blueprints dir) to include
 *   in the workspace
 */
export const loadWorkspace = async (
  blueprintsDir: string,
  blueprintsFiles: string[],
): Promise<Workspace> => {
  const bps = await loadBlueprints(blueprintsDir, blueprintsFiles)
  const parsedBlueprints = await parseBlueprints(bps)
  return new Workspace(blueprintsDir, parsedBlueprints)
}
