import * as fs from 'async-file'
import path from 'path'
import readdirp from 'readdirp'
import { Blueprint } from '../blueprints/blueprint'

const getBluePrintsFromDir = async (
  blueprintsDir: string,
): Promise<string[]> => {
  const entries = await readdirp.promise(blueprintsDir, { fileFilter: '*.bp' })
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
      const dirFiles = await getBluePrintsFromDir(blueprintsDir)
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
