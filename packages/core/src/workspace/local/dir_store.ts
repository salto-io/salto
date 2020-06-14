/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import readdirp from 'readdirp'
import path from 'path'
import { Stats } from 'fs'
import _ from 'lodash'
import {
  stat, readTextFile, exists, rm, mkdirp, replaceContents, isEmptyDir, isSubDirectory,
  rename, existsSync, readTextFileSync, statSync,
} from '@salto-io/file'
import { promises } from '@salto-io/lowerdash'
import { File, SyncDirectoryStore } from '../dir_store'

const { withLimitedConcurrency, series } = promises.array

const READ_CONCURRENCY = 100
const WRITE_CONCURRENCY = 100
const DELETE_CONCURRENCY = 100
const RENAME_CONCURRENCY = 100

type FileMap = {
  [key: string]: File
}

const buildLocalDirectoryStore = (
  baseDir: string,
  fileFilter?: string,
  directoryFilter?: (path: string) => boolean,
  initUpdated?: FileMap,
  initDeleted? : string[],
): SyncDirectoryStore => {
  let currentBaseDir = baseDir
  let updated: FileMap = initUpdated || {}
  let deleted: string[] = initDeleted || []

  const getAbsFileName = (filename: string, dir?: string): string =>
    path.resolve(dir ?? currentBaseDir, filename)

  const getRelativeFileName = (filename: string, dir?: string): string => {
    const base = dir || currentBaseDir
    const isAbsolute = path.isAbsolute(filename)
    if (
      (isAbsolute || filename.split(path.sep).includes('..'))
        && path.relative(base, filename).startsWith(`..${path.sep}`)
    ) {
      throw new Error(`Filepath not contained in dir store base dir: ${filename}`)
    }
    return isAbsolute
      ? path.relative(base, filename)
      : filename
  }
  const listDirFiles = async (listDirectories = false):
  Promise<string[]> => (await exists(currentBaseDir)
    ? readdirp.promise(currentBaseDir, {
      fileFilter: fileFilter || (() => true),
      directoryFilter: e => e.basename[0] !== '.'
        && (!directoryFilter || directoryFilter(e.fullPath)),
      type: listDirectories ? 'directories' : 'files',
    }).then(entries => entries.map(e => e.fullPath).map(x => getRelativeFileName(x)))
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

  const readFileSync = (filename: string): File | undefined => {
    const absFileName = getAbsFileName(filename)
    return existsSync(absFileName)
      ? {
        filename,
        buffer: readTextFileSync(absFileName),
        timestamp: (statSync(absFileName) as Stats).mtimeMs,
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

  const removeDirIfEmpty = async (dirPath: string): Promise<void> => {
    if (await exists(dirPath)
      && await isEmptyDir(dirPath)
      && isSubDirectory(dirPath, currentBaseDir)) {
      await rm(dirPath)
      await removeDirIfEmpty(path.dirname(dirPath))
    }
  }

  const deleteFile = async (filename: string, shouldDeleteEmptyDir = false): Promise<void> => {
    const absFileName = getAbsFileName(filename)
    try {
      getRelativeFileName(absFileName)
    } catch (err) {
      return Promise.reject(err)
    }

    if (await exists(absFileName)) {
      await rm(absFileName)
      if (shouldDeleteEmptyDir) {
        await removeDirIfEmpty(path.dirname(absFileName))
      }
    }
    return Promise.resolve()
  }

  const mtimestampFile = async (filename: string): Promise<number | undefined> => (updated[filename]
    ? updated[filename].timestamp
    : (await stat.notFoundAsUndefined(getAbsFileName(filename)))?.mtimeMs)

  const get = async (filename: string): Promise<File | undefined> => {
    let relFilename: string
    try {
      relFilename = getRelativeFileName(filename)
    } catch (err) {
      return Promise.reject(err)
    }
    return (updated[relFilename] ? updated[relFilename] : readFile(relFilename))
  }

  const getSync = (filename: string): File | undefined => {
    const relFilename = getRelativeFileName(filename)
    return (updated[relFilename] ? updated[relFilename] : readFileSync(relFilename))
  }

  const list = async (): Promise<string[]> =>
    _(await listDirFiles())
      .concat(Object.keys(updated))
      .filter(file => !deleted.includes(file))
      .uniq()
      .value()

  const flush = async (): Promise<void> => {
    await withLimitedConcurrency(
      Object.values(updated).map(f => () => writeFile(f)), WRITE_CONCURRENCY
    )
    await withLimitedConcurrency(deleted.map(f => () => deleteFile(f, true)), DELETE_CONCURRENCY)
    updated = {}
    deleted = []
  }

  const deleteAllEmptyDirectories = async (): Promise<void> => {
    await series((await listDirFiles(true))
      .map(f => () => removeDirIfEmpty(getAbsFileName(f))))
  }

  return {
    list,
    get,
    getSync,
    set: async (file: File): Promise<void> => {
      let relFilename: string
      try {
        relFilename = getRelativeFileName(file.filename)
      } catch (err) {
        return Promise.reject(err)
      }
      file.timestamp = Date.now()
      updated[relFilename] = file
      deleted = deleted.filter(filename => filename !== relFilename)
      return Promise.resolve()
    },

    delete: async (filename: string): Promise<void> => {
      let relFilename: string
      try {
        relFilename = getRelativeFileName(filename)
      } catch (err) {
        return Promise.reject(err)
      }
      deleted.push(relFilename)
      return Promise.resolve()
    },

    clear: async (): Promise<void> => {
      const allFiles = await list()
      await withLimitedConcurrency(allFiles.map(f => () => deleteFile(f)), DELETE_CONCURRENCY)
      updated = {}
      deleted = []
      await deleteAllEmptyDirectories()
      await removeDirIfEmpty(currentBaseDir)
    },

    rename: async (name: string): Promise<void> => {
      const allFiles = await list()
      const newBaseDir = path.join(path.dirname(currentBaseDir), name)
      const renameFile = async (file: string): Promise<void> => {
        const newPath = getAbsFileName(file, newBaseDir)
        const currentPath = getAbsFileName(file)
        if (await exists(currentPath)) {
          await mkdirp(path.dirname(newPath))
          await rename(currentPath, newPath)
        }
      }
      await withLimitedConcurrency(allFiles.map(f => () => renameFile(f)), RENAME_CONCURRENCY)
      await deleteAllEmptyDirectories()
      await removeDirIfEmpty(currentBaseDir)
      currentBaseDir = newBaseDir
    },

    renameFile: async (name: string, newName: string): Promise<void> =>
      rename(getAbsFileName(name), getAbsFileName(newName)),

    mtimestamp: async (filename: string): Promise<undefined | number> => {
      let relFilename: string
      try {
        relFilename = getRelativeFileName(filename)
      } catch (err) {
        return Promise.reject(err)
      }
      return (updated[relFilename]
        ? Promise.resolve(updated[relFilename].timestamp)
        : mtimestampFile(relFilename))
    },

    flush,

    getFiles: async (filenames: string[]): Promise<(File | undefined) []> =>
      withLimitedConcurrency(filenames.map(f => () => get(f)), READ_CONCURRENCY),

    getTotalSize: async (): Promise<number> => {
      const allFiles = (await list()).map(f => getAbsFileName(f))
      return _.sum(await Promise.all(allFiles.map(async filePath => (await stat(filePath)).size)))
    },

    clone: (): SyncDirectoryStore => buildLocalDirectoryStore(
      currentBaseDir,
      fileFilter,
      directoryFilter,
      _.cloneDeep(updated),
      _.cloneDeep(deleted)
    ),
  }
}

export const localDirectoryStore = (
  baseDir: string,
  fileFilter?: string,
  directoryFilter?: (path: string) => boolean,
): SyncDirectoryStore => buildLocalDirectoryStore(
  baseDir, fileFilter, directoryFilter,
)
