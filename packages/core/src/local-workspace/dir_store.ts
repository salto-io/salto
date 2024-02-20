/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import _ from 'lodash'
import * as fileUtils from '@salto-io/file'
import { promises } from '@salto-io/lowerdash'
import { dirStore } from '@salto-io/workspace'
import { logger } from '@salto-io/logging'

const { withLimitedConcurrency, series } = promises.array
const log = logger(module)

const READ_CONCURRENCY = 100
const WRITE_CONCURRENCY = 100
const DELETE_CONCURRENCY = 100
const RENAME_CONCURRENCY = 100

type FileMap<T extends dirStore.ContentType> = Record<string, dirStore.File<T>>
type FilePathFilter = (filePath: string) => boolean
export const createExtensionFileFilter =
  (extension: string): FilePathFilter =>
  (filePath: string) =>
    path.extname(filePath) === extension

const buildLocalDirectoryStore = <T extends dirStore.ContentType>(
  baseDir: string,
  storeName?: string,
  nameSuffix?: string,
  accessiblePath = '',
  encoding?: BufferEncoding,
  fileFilter?: FilePathFilter,
  directoryFilter?: FilePathFilter,
  initUpdated?: FileMap<T>,
  initDeleted?: string[],
): dirStore.DirectoryStore<T> => {
  let currentBaseDir = path.join(..._.compact([baseDir, storeName, nameSuffix]))
  let updated: FileMap<T> = initUpdated || {}
  let deleted: Set<string> = new Set(initDeleted || [])

  const getAbsFileName = (filename: string, dir?: string): string => path.resolve(dir ?? currentBaseDir, filename)

  const getAccessibleFullPath = (): string => path.join(currentBaseDir, accessiblePath)

  const isContainedInDirStore = (filename: string): boolean => {
    const accessibleFullPath = getAccessibleFullPath()
    const isAbsolute = path.isAbsolute(filename)
    return !path
      .relative(accessibleFullPath, isAbsolute ? filename : getAbsFileName(filename))
      .startsWith(`..${path.sep}`)
  }

  const getRelativeFileName = (filename: string): string => {
    if (!isContainedInDirStore(filename)) {
      throw new Error(`Filepath not contained in dir store base dir: ${filename}`)
    }

    return path.isAbsolute(filename) ? path.relative(currentBaseDir, filename) : filename
  }

  const listDirFiles = async (listDirectories = false): Promise<string[]> =>
    (await fileUtils.exists(getAccessibleFullPath()))
      ? readdirp
          .promise(getAccessibleFullPath(), {
            fileFilter: fileFilter ? e => fileFilter(e.fullPath) : () => true,
            directoryFilter: e => e.basename[0] !== '.' && (!directoryFilter || directoryFilter(e.fullPath)),
            type: listDirectories ? 'directories' : 'files',
          })
          .then(entries => entries.map(e => e.fullPath).map(x => getRelativeFileName(x)))
      : []

  const readFile = async (filename: string): Promise<dirStore.File<T> | undefined> => {
    const absFileName = getAbsFileName(filename)
    return (await fileUtils.exists(absFileName))
      ? {
          filename,
          buffer: (await fileUtils.readFile(absFileName, { encoding })) as T,
          timestamp: (await fileUtils.stat(absFileName)).mtimeMs,
        }
      : undefined
  }

  const writeFile = async (file: dirStore.File<T>): Promise<void> => {
    const absFileName = getAbsFileName(file.filename)
    if (!(await fileUtils.exists(path.dirname(absFileName)))) {
      await fileUtils.mkdirp(path.dirname(absFileName))
    }
    return fileUtils.replaceContents(absFileName, file.buffer, encoding)
  }

  const removeDirIfEmpty = async (dirPath: string): Promise<void> => {
    if (
      (await fileUtils.isEmptyDir.notFoundAsUndefined(dirPath)) &&
      fileUtils.isSubDirectory(dirPath, currentBaseDir)
    ) {
      await fileUtils.rm(dirPath)
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

    if (await fileUtils.exists(absFileName)) {
      await fileUtils.rm(absFileName)
      if (shouldDeleteEmptyDir) {
        await removeDirIfEmpty(path.dirname(absFileName))
      }
    }
    return Promise.resolve()
  }

  const mtimestampFile = async (filename: string): Promise<number | undefined> => {
    if (deleted.has(filename)) {
      return undefined
    }

    return updated[filename]
      ? updated[filename].timestamp
      : (await fileUtils.stat.notFoundAsUndefined(getAbsFileName(filename)))?.mtimeMs
  }

  const get = async (filename: string, options?: dirStore.GetFileOptions): Promise<dirStore.File<T> | undefined> => {
    let relFilename: string
    try {
      relFilename = getRelativeFileName(filename)
    } catch (err) {
      return Promise.reject(err)
    }

    if (!options?.ignoreDeletionsCache && deleted.has(relFilename)) {
      return undefined
    }

    return updated[relFilename] ? updated[relFilename] : readFile(relFilename)
  }

  const list = async (): Promise<string[]> =>
    _(await listDirFiles())
      .concat(Object.keys(updated))
      .filter(file => !deleted.has(file))
      .uniq()
      .value()

  const isEmpty = async (): Promise<boolean> => (await list()).length === 0

  const flush = async (): Promise<void> => {
    const deletesToHandle = deleted
    deleted = new Set()
    const updatesToHandle = updated
    updated = {}
    // first delete the files, so that we can create files nested under deleted-file paths and vice versa
    // (e.g., removing a and creating a/b)
    await withLimitedConcurrency(
      Array.from(deletesToHandle).map(f => () => deleteFile(f, true)),
      DELETE_CONCURRENCY,
    )
    await withLimitedConcurrency(
      Object.values(updatesToHandle).map(f => () => writeFile(f)),
      WRITE_CONCURRENCY,
    )
    if (deleted.size > 0 || Object.keys(updated).length > 0) {
      log.warn(
        'there are %d pending deletions and %d pending updates that were added while flushing the dir_store',
        deleted.size,
        Object.keys(updated).length,
      )
    }
  }

  const deleteAllEmptyDirectories = async (): Promise<void> => {
    const subdirs = await listDirFiles(true)
    await series((!_.isEmpty(subdirs) ? subdirs : [currentBaseDir]).map(f => () => removeDirIfEmpty(getAbsFileName(f))))
  }

  const isPathIncluded = (filePath: string): boolean => {
    const absPath = getAbsFileName(filePath)
    if (!isContainedInDirStore(absPath)) {
      return false
    }
    if (fileFilter && !fileFilter(absPath)) {
      return false
    }
    if (directoryFilter && !directoryFilter(absPath)) {
      return false
    }
    return true
  }

  return {
    list,
    isEmpty,
    get,
    set: async (file: dirStore.File<T>): Promise<void> => {
      let relFilename: string
      try {
        relFilename = getRelativeFileName(file.filename)
      } catch (err) {
        return Promise.reject(err)
      }
      file.timestamp = Date.now()
      updated[relFilename] = file
      deleted.delete(relFilename)
      return Promise.resolve()
    },

    delete: async (filename: string): Promise<void> => {
      let relFilename: string
      try {
        relFilename = getRelativeFileName(filename)
      } catch (err) {
        return Promise.reject(err)
      }
      deleted.add(relFilename)
      return Promise.resolve()
    },

    clear: async (): Promise<void> => {
      const allFiles = await listDirFiles()
      await withLimitedConcurrency(
        allFiles.map(f => () => deleteFile(f)),
        DELETE_CONCURRENCY,
      )
      updated = {}
      deleted = new Set()
      await deleteAllEmptyDirectories()
    },

    rename: async (name: string): Promise<void> => {
      const allFiles = await list()
      const newBaseDir = path.join(baseDir, name, nameSuffix || '')
      const renameFile = async (file: string): Promise<void> => {
        const newPath = getAbsFileName(file, newBaseDir)
        const currentPath = getAbsFileName(file)
        if (await fileUtils.exists(currentPath)) {
          await fileUtils.mkdirp(path.dirname(newPath))
          await fileUtils.rename(currentPath, newPath)
        }
      }
      await withLimitedConcurrency(
        allFiles.map(f => () => renameFile(f)),
        RENAME_CONCURRENCY,
      )
      await deleteAllEmptyDirectories()
      await removeDirIfEmpty(currentBaseDir)
      currentBaseDir = newBaseDir
    },

    renameFile: async (name: string, newName: string): Promise<void> =>
      fileUtils.rename.notFoundAsUndefined(getAbsFileName(name), getAbsFileName(newName)),

    mtimestamp: async (filename: string): Promise<undefined | number> => {
      let relFilename: string
      try {
        relFilename = getRelativeFileName(filename)
      } catch (err) {
        return Promise.reject(err)
      }

      return mtimestampFile(relFilename)
    },

    flush,

    getFiles: async (
      filenames: string[],
      options: dirStore.GetFileOptions,
    ): Promise<(dirStore.File<T> | undefined)[]> =>
      log.time(
        () =>
          withLimitedConcurrency(
            filenames.map(f => () => get(f, options)),
            READ_CONCURRENCY,
          ),
        'getFiles for %d files with read concurrency %d',
        filenames.length,
        READ_CONCURRENCY,
      ),

    getTotalSize: async (): Promise<number> => {
      const allFiles = (await list()).map(f => getAbsFileName(f))
      return _.sum(await Promise.all(allFiles.map(async filePath => (await fileUtils.stat(filePath)).size)))
    },

    clone: (): dirStore.DirectoryStore<T> =>
      buildLocalDirectoryStore(
        currentBaseDir,
        storeName,
        nameSuffix,
        accessiblePath,
        encoding,
        fileFilter,
        directoryFilter,
        _.cloneDeep(updated),
        Array.from(deleted),
      ),
    getFullPath: filename => getAbsFileName(filename),
    isPathIncluded,
    exists: async (filename: string): Promise<boolean> => fileUtils.exists(getAbsFileName(filename)),
  }
}

type LocalDirectoryStoreParams = {
  baseDir: string
  name?: string
  nameSuffix?: string
  accessiblePath?: string
  encoding?: 'utf8'
  fileFilter?: FilePathFilter
  directoryFilter?: FilePathFilter
}

export function localDirectoryStore(
  params: Omit<LocalDirectoryStoreParams, 'encoding'>,
): dirStore.DirectoryStore<Buffer>

export function localDirectoryStore(
  params: LocalDirectoryStoreParams & Required<Pick<LocalDirectoryStoreParams, 'encoding'>>,
): dirStore.DirectoryStore<string>

export function localDirectoryStore({
  baseDir,
  name,
  nameSuffix,
  accessiblePath,
  encoding,
  fileFilter,
  directoryFilter,
}: LocalDirectoryStoreParams): dirStore.DirectoryStore<dirStore.ContentType> {
  return buildLocalDirectoryStore<dirStore.ContentType>(
    baseDir,
    name,
    nameSuffix,
    accessiblePath,
    encoding,
    fileFilter,
    directoryFilter,
  )
}
