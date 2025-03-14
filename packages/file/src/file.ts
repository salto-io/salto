/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { promisify } from 'util'
import fs from 'fs'
import rimRafLib from 'rimraf'
import mkdirpLib from 'mkdirp'
import path from 'path'
import { strings } from '@salto-io/lowerdash'

export const rm = promisify(rimRafLib)
export const mkdirp = promisify(mkdirpLib)

export const { copyFile, writeFile, readFile, readdir: readDir } = fs.promises
export const { statSync, existsSync, readFileSync, createReadStream, createWriteStream } = fs

export const notFoundAsUndefined =
  <TArgs extends unknown[], TReturn>(
    f: (...args: TArgs) => Promise<TReturn>,
  ): ((...args: TArgs) => Promise<TReturn | undefined>) =>
  async (...args: TArgs): Promise<TReturn | undefined> => {
    try {
      return await f(...args)
    } catch (err) {
      if (err.code === 'ENOENT') {
        return undefined
      }
      throw err
    }
  }

export const rename = (oldPath: string, newPath: string): Promise<void> => fs.promises.rename(oldPath, newPath)
rename.notFoundAsUndefined = notFoundAsUndefined(rename)

export const stat = (filename: string): Promise<fs.Stats> => fs.promises.stat(filename)
stat.notFoundAsUndefined = notFoundAsUndefined(stat)

export const isSubDirectory = (subFolder: string, folder: string): boolean => {
  const relative = path.relative(folder, subFolder)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

export const isEmptyDir = async (dirPath: string): Promise<boolean> => (await readDir(dirPath)).length === 0
isEmptyDir.notFoundAsUndefined = notFoundAsUndefined(isEmptyDir)

export const exists = async (filename: string): Promise<boolean> =>
  (await stat.notFoundAsUndefined(filename)) !== undefined

export const readTextFileSync = (filename: string): string => fs.readFileSync(filename, { encoding: 'utf8' })

export const readTextFile = (filename: string): Promise<string> => readFile(filename, { encoding: 'utf8' })

readTextFile.notFoundAsUndefined = notFoundAsUndefined(readTextFile)

export const appendTextFile = (filename: string, contents: string): Promise<void> =>
  writeFile(filename, contents, { encoding: 'utf8', flag: 'a' })

export const replaceContents = async (
  filename: string,
  contents: Buffer | string,
  encoding?: BufferEncoding,
): Promise<void> => {
  const tempFilename = `${filename}.tmp.${strings.insecureRandomString()}`
  await writeFile(tempFilename, contents, { encoding })
  await rename(tempFilename, filename)
}
