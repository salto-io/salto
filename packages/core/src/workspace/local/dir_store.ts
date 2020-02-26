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
import _ from 'lodash'
import { promises } from '@salto-io/lowerdash'
import { stat, readTextFile, Stats, exists, rm, mkdirp, replaceContents } from '../../file'
import { DirectoryStore, File } from '../dir_store'

const { chunkSeries } = promises.array

const READ_CONCURRENCY = 100
const WRITE_CONCURRENCY = 100
const DELETE_CONCURRENCY = 100

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

  const get = async (filename: string): Promise<File | undefined> => {
    const relFilename = getRelativeFileName(filename)
    return (updated[relFilename] ? updated[relFilename] : readFile(relFilename))
  }

  return {
    list: async (): Promise<string[]> =>
      _(await listDirFiles())
        .concat(Object.keys(updated))
        .filter(file => !deleted.includes(file))
        .uniq()
        .value(),

    get,

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
      await chunkSeries(Object.values(updated).map(f => () => writeFile(f)), WRITE_CONCURRENCY)
      await chunkSeries(deleted.map(f => () => deleteFile(f)), DELETE_CONCURRENCY)
      updated = {}
      deleted = []
    },

    getFiles: async (filenames: string[]): Promise<(File | undefined) []> =>
      chunkSeries(filenames.map(f => () => get(f)), READ_CONCURRENCY),
  }
}
