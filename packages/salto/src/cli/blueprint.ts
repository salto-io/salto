import * as fs from 'async-file'
import * as path from 'path'
import Blueprint from '../blueprints/blueprint'

const getBluePrintsFromDir = async (
  blueprintsDir: string,
): Promise<string[]> => {
  const dirFiles = await fs.readdir(blueprintsDir)
  return dirFiles
    .filter(f => path.extname(f).toLowerCase() === '.bp')
    .map(f => path.join(blueprintsDir, f))
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
export const dumpBlueprint = (
  blueprint: Blueprint
): Promise<void> => fs.writeFile(blueprint.filename, blueprint.buffer)
