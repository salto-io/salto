import readdirp from 'readdirp'
import path from 'path'
import _ from 'lodash'
import { stat, readTextFile, Stats, exists, rm, mkdirp, replaceContents } from '../../file'
import { DirectoryStore, File } from '../dir_store'

type FileMap = {
  [key: string]: File
}

export const localDirectoryStore = (dir: string, fileFilter?: string): DirectoryStore => {
  let updated: FileMap = {}
  let deleted: string[] = []

  const getAbsFileName = (filename: string): string => path.resolve(dir, filename)

  const listDirFiles = async (): Promise<string[]> => (await exists(dir)
    ? readdirp.promise(dir, {
      fileFilter,
      directoryFilter: e => e.basename[0] !== '.',
    }).then(entries => entries.map(e => e.fullPath))
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

    get: async (filename: string): Promise<File | undefined> =>
      (updated[filename] ? updated[filename] : readFile(filename)),

    set: async (file: File): Promise<void> => {
      file.timestamp = Date.now()
      updated[file.filename] = file
    },

    delete: async (filename: string): Promise<void> => {
      deleted.push(filename)
    },

    mtimestamp: async (filename: string): Promise<undefined | number> =>
      (updated[filename]
        ? Promise.resolve(updated[filename].timestamp)
        : mtimestampFile(filename)),

    flush: async (): Promise<void> => {
      await Promise.all(Object.values(updated).map(writeFile))
      await Promise.all(deleted.map(deleteFile))
      updated = {}
      deleted = []
    },
  }
}
