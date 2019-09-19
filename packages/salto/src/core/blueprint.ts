import _ from 'lodash'
import { Element } from 'adapter-api'

import * as fs from 'async-file'
import path from 'path'
import readdirp from 'readdirp'
import { SourceMap, ParseError, parse } from '../parser/parse'

export interface Blueprint {
  buffer: Buffer
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

const loadBlueprint = async (blueprintFile: string): Promise<Blueprint> => ({
  buffer: await fs.readFile(blueprintFile, 'utf8'),
  filename: blueprintFile,
})

/**
 * Reads all of the blueprints specified by the use by full name, or by providing the directory
 * inwhich they resides.
 * @param  {Array<string>} blueprintsFile An array of pathes to blueprint files to load.
 * @param  {string} A path to the blueprints directory //TODO - Should this also be an array?
 * @return {Promise<Array<string>>} A promise with an array of the bp files content as values
 */
export const loadBlueprints = async (
  blueprintsFiles: string[],
  blueprintsDir?: string,
): Promise<Blueprint[]> => {
  try {
    let allBlueprintsFiles = blueprintsFiles
    if (blueprintsDir) {
      const dirFiles = await getBlueprintsFromDir(blueprintsDir)
      allBlueprintsFiles = allBlueprintsFiles.concat(dirFiles)
    }
    const blueprints = allBlueprintsFiles.map(loadBlueprint)
    return await Promise.all(blueprints)
  } catch (e) {
    throw Error(`Failed to load blueprints files: ${e.message}`)
  }
}

/**
 * Write blueprint to file
 * @param blueprint The blueprint to dump
 */
export const dumpBlueprints = async (
  blueprints: Blueprint[]
): Promise<void> => {
  await Promise.all(blueprints.map(
    async bp => {
      await fs.mkdirp(path.dirname(bp.filename))
      await fs.writeFile(bp.filename, bp.buffer)
    }
  ))
}

export const parseBlueprints = (blueprints: Blueprint[]): Promise<ParsedBlueprint[]> =>
  Promise.all(blueprints.map(async bp => ({
    ...bp,
    ...(await parse(bp.buffer, bp.filename)),
  })))

export const getAllElements = async (blueprints: Blueprint[]): Promise<Element[]> => {
  const parseResults = await parseBlueprints(blueprints)

  const elements = _.flatten(parseResults.map(r => r.elements))
  const errors = _.flatten(parseResults.map(r => r.errors))

  if (errors.length > 0) {
    throw new Error(`Failed to parse blueprints: ${errors.join('\n')}`)
  }

  return elements
}
