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
  stat, readTextFile, exists, rm, mkdirp, replaceContents, isEmptyDir, isSubDirectory, rename,
} from '@salto-io/file'
import { promises } from '@salto-io/lowerdash'
import { DirectoryStore, File } from '../dir_store'

const { withLimitedConcurrency } = promises.array

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
  initDeleted? : string[]
): DirectoryStore => {
  let currentBaseDir = baseDir
  let updated: FileMap = initUpdated || {}
  let deleted: string[] = initDeleted || []

  const getAbsFileName = (filename: string, dir?: string): string =>
    path.resolve(dir ?? currentBaseDir, filename)

  const getRelativeFileName = (filename: string): string => (path.isAbsolute(filename)
    ? path.relative(currentBaseDir, filename)
    : filename)

  const listDirFiles = async (): Promise<string[]> => (await exists(currentBaseDir)
    ? readdirp.promise(currentBaseDir, {
      fileFilter: fileFilter || (() => true),
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

  const removeDirIfEmpty = async (dirPath: string): Promise<void> => {
    if (await isEmptyDir(dirPath) && isSubDirectory(dirPath, currentBaseDir)) {
      await rm(dirPath)
      await removeDirIfEmpty(path.dirname(dirPath))
    }
  }

  const deleteFile = async (filename: string): Promise<void> => {
    const absFileName = getAbsFileName(filename)
    if (await exists(absFileName)) {
      await rm(absFileName)
      await removeDirIfEmpty(path.dirname(absFileName))
    }
  }

  const mtimestampFile = async (filename: string): Promise<number | undefined> => (updated[filename]
    ? updated[filename].timestamp
    : (await stat.notFoundAsUndefined(getAbsFileName(filename)))?.mtimeMs)

  const get = async (filename: string): Promise<File | undefined> => {
    const relFilename = getRelativeFileName(filename)
    return (updated[relFilename] ? updated[relFilename] : readFile(relFilename))
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
    await withLimitedConcurrency(deleted.map(f => () => deleteFile(f)), DELETE_CONCURRENCY)
    updated = {}
    deleted = []
  }

  return {
    list,
    get,

    set: async (file: File): Promise<void> => {
      const relFilename = getRelativeFileName(file.filename)
      file.timestamp = Date.now()
      updated[relFilename] = file
      deleted = deleted.filter(filename => filename !== relFilename)
    },

    delete: async (filename: string): Promise<void> => {
      const relFilename = getRelativeFileName(filename)
      deleted.push(relFilename)
    },

    clear: async (): Promise<void> => {
      (await list()).forEach(f => deleted.push(f))
      updated = {}
      await flush()

      // Handles the case when there are no files
      await removeDirIfEmpty(currentBaseDir)
    },

    rename: async (name: string): Promise<void> => {
      const allFiles = await list()
      const newBaseDir = path.join(path.dirname(currentBaseDir), name)
      const renameFile = async (file: string): Promise<void> => {
        const newPath = getAbsFileName(file, newBaseDir)
        if (!(await exists(path.dirname(newPath)))) {
          await mkdirp(path.dirname(newPath))
        }
        await rename(getAbsFileName(file), newPath)
      }
      await withLimitedConcurrency(allFiles.map(f => () => renameFile(f)), RENAME_CONCURRENCY)

      // Handles the case when there are no files
      await removeDirIfEmpty(currentBaseDir)
      currentBaseDir = newBaseDir
    },

    mtimestamp: async (filename: string): Promise<undefined | number> => {
      const relFilename = getRelativeFileName(filename)
      return (updated[relFilename]
        ? Promise.resolve(updated[relFilename].timestamp)
        : mtimestampFile(relFilename))
    },

    flush,

    getFiles: async (filenames: string[]): Promise<(File | undefined) []> =>
      withLimitedConcurrency(filenames.map(f => () => get(f)), READ_CONCURRENCY),

    clone: () => buildLocalDirectoryStore(
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
): DirectoryStore => buildLocalDirectoryStore(baseDir, fileFilter, directoryFilter)
