import readdirp from 'readdirp'
import path from 'path'
import _ from 'lodash'
import { stat, readTextFile, Stats, exists, rm, mkdirp, replaceContents } from '../../file'
import { DirectoryStore, File } from '../dir_store'

type FileMap = {
  [key: string]: File
}

export const localDirectoryStore = (
  baseDir: string,
  fileFilter?: string,
  directoryFilter?: (path: string) => boolean,
): DirectoryStore => {
  let updated: FileMap = {}
  let deleted: string[] = []

  const getAbsFileName = (filename: string): string => path.resolve(baseDir, filename)

  const getRelativeFileName = (filename: string): string => (path.isAbsolute(filename)
    ? path.relative(baseDir, filename)
    : filename)

  const listDirFiles = async (): Promise<string[]> => (await exists(baseDir)
    ? readdirp.promise(baseDir, {
      fileFilter,
      directoryFilter: e => e.basename[0] !== '.'
          && (!directoryFilter || directoryFilter(e.fullPath)),
    }).then(entries => entries.map(e => e.fullPath).map(getRelativeFileName))
    : [])

  const readFile = async (filename: string): Promise<File | undefined> => {
    const absFileName = getAbsFileName(filename)
    return await exists(absFileName)
      ? {
        filename,
        buffer: await readTextFile(absFileName),
        timestamp: (await stat(absFileName) as Stats).mtimeMs,
      }
      : undefined
  }

  const writeFile = async (file: File): Promise<void> => {
    const absFileName = getAbsFileName(file.filename)
    if (!await exists(path.dirname(absFileName))) {
      await mkdirp(path.dirname(absFileName))
    }
    return replaceContents(absFileName, file.buffer)
  }

  const deleteFile = async (filename: string): Promise<void> => rm(getAbsFileName(filename))

  const mtimestampFile = async (filename: string): Promise<number | undefined> =>
    (await stat.notFoundAsUndefined(getAbsFileName(filename)))?.mtimeMs

  return {
    list: async (): Promise<string[]> =>
      _(await listDirFiles())
        .concat(Object.keys(updated))
        .filter(file => !deleted.includes(file))
        .uniq()
        .value(),

    get: async (filename: string): Promise<File | undefined> => {
      const relFilename = getRelativeFileName(filename)
      return (updated[relFilename] ? updated[relFilename] : readFile(relFilename))
    },

    set: async (file: File): Promise<void> => {
      const relFilename = getRelativeFileName(file.filename)
      file.timestamp = Date.now()
      updated[relFilename] = file
    },

    delete: async (filename: string): Promise<void> => {
      const relFilename = getRelativeFileName(filename)
      deleted.push(relFilename)
    },

    mtimestamp: async (filename: string): Promise<undefined | number> => {
      const relFilename = getRelativeFileName(filename)
      return (updated[relFilename]
        ? Promise.resolve(updated[relFilename].timestamp)
        : mtimestampFile(relFilename))
    },

    flush: async (): Promise<void> => {
      await Promise.all(Object.values(updated).map(writeFile))
      await Promise.all(deleted.map(deleteFile))
      updated = {}
      deleted = []
    },
  }
}
