import readdirp from 'readdirp'
import path from 'path'
import { stat, readTextFile, Stats } from '../file'

export const BP_EXTENSION = '.bp'

export type Blueprint = {
  buffer: string
  filename: string
  timestamp?: number
}

const getBlueprintsFromDir = async (
  blueprintsDir: string,
): Promise<string[]> => {
  const entries = await readdirp.promise(blueprintsDir, {
    fileFilter: `*${BP_EXTENSION}`,
    directoryFilter: e => e.basename[0] !== '.',
  })
  return entries.map(e => e.fullPath)
}

export const loadBlueprint = async (filename: string, blueprintsDir: string
): Promise<Blueprint> => {
  const relFileName = path.isAbsolute(filename)
    ? path.relative(blueprintsDir, filename)
    : filename
  const absFileName = path.resolve(blueprintsDir, filename)
  return {
    filename: relFileName,
    buffer: await readTextFile(absFileName),
    timestamp: (await stat(absFileName) as Stats).mtimeMs,
  }
}

export const loadBlueprints = async (
  blueprintsDir: string,
): Promise<Blueprint[]> => {
  try {
    const filenames = await getBlueprintsFromDir(blueprintsDir)
    return Promise.all(filenames.map(filename => loadBlueprint(filename, blueprintsDir)))
  } catch (e) {
    throw Error(`Failed to load blueprint files: ${e.message}`)
  }
}
