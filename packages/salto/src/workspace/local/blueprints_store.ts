import readdirp from 'readdirp'
import path from 'path'
import BlueprintsStore, { BP_EXTENSION, Blueprint } from '../blueprints_store'
import { stat, readTextFile, Stats, exists, rm, mkdirp, replaceContents } from '../../file'

// TODO: should test files in sub dir, skip hiddem dirs
export const localBlueprintsStore = (dir: string): BlueprintsStore => {
  const getAbsFileName = (filename: string): string => path.resolve(dir, filename)

  return {
    list: async (): Promise<string[]> => {
      const entries = await exists(dir)
        ? await readdirp.promise(dir, {
          fileFilter: `*${BP_EXTENSION}`,
          directoryFilter: e => e.basename[0] !== '.',
        })
        : []
      return entries.map(e => e.fullPath)
    },

    get: async (filename: string): Promise<Blueprint | undefined> => {
      const absFileName = getAbsFileName(filename)
      return await exists(absFileName)
        ? {
          filename,
          buffer: await readTextFile(absFileName),
          timestamp: (await stat(absFileName) as Stats).mtimeMs,
        }
        : undefined
    },

    set: async (blueprint: Blueprint): Promise<void> => {
      const absFileName = getAbsFileName(blueprint.filename)
      if (!await exists(path.dirname(absFileName))) {
        await mkdirp(path.dirname(absFileName))
      }
      return replaceContents(absFileName, blueprint.buffer)
    },

    delete: (filename: string): Promise<void> => rm(getAbsFileName(filename)),
  }
}
