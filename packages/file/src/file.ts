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
import { promisify } from 'util'
import fs from 'fs'
import pako from 'pako'
import rimRafLib from 'rimraf'
import mkdirpLib from 'mkdirp'
import path from 'path'
import { strings } from '@salto-io/lowerdash'

export const rm = promisify(rimRafLib)
export const mkdirp = promisify(mkdirpLib)

export const { rename, copyFile, writeFile, readFile, readdir: readDir } = fs.promises
export const { statSync, existsSync, readFileSync } = fs

export const notFoundAsUndefined = <
  TArgs extends unknown[],
  TReturn,
  >(
    f: (...args: TArgs) => Promise<TReturn>
  ): (...args: TArgs) => Promise<TReturn | undefined> => async (
    ...args: TArgs
  ): Promise<TReturn | undefined> => {
    try {
      return await f(...args)
    } catch (err) {
      if (err.code === 'ENOENT') {
        return undefined
      }
      throw err
    }
  }

export const stat = (filename: string): Promise<fs.Stats> => fs.promises.stat(filename)
stat.notFoundAsUndefined = notFoundAsUndefined(stat)

export const isSubDirectory = (
  subFolder: string,
  folder: string
): boolean => {
  const relative = path.relative(folder, subFolder)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

export const isEmptyDir = async (
  dirPath: string
): Promise<boolean> => (await readDir(dirPath)).length === 0

export const exists = async (
  filename: string
): Promise<boolean> => (await stat.notFoundAsUndefined(filename)) !== undefined

export const readTextFileSync = (
  filename: string,
): string => fs.readFileSync(filename, { encoding: 'utf8' })

export const readTextFile = (
  filename: string,
): Promise<string> => readFile(filename, { encoding: 'utf8' })

export const readZipFile = async (
  zipFilename: string,
): Promise<string | undefined> => {
  const data = await readFile(zipFilename, { encoding: 'utf8' })
  try {
    return pako.ungzip(data, { to: 'string' })
  } catch {
    return undefined
  }
}

readTextFile.notFoundAsUndefined = notFoundAsUndefined(readTextFile)

export const generateZipString = async (contents: string | Buffer):
  Promise<string> => pako.gzip(contents, { to: 'string' })

export const writeZipFile = async (
  zipFilename: string,
  contents: Buffer | string,
): Promise<void> => {
  const zipContent = await generateZipString(contents)
  await writeFile(zipFilename, zipContent)
}

export const appendTextFile = (
  filename: string,
  contents: string,
): Promise<void> => writeFile(filename, contents, { encoding: 'utf8', flag: 'a' })

export const replaceContents = async (
  filename: string,
  contents: Buffer | string,
  encoding?: string,
): Promise<void> => {
  const tempFilename = `${filename}.tmp.${strings.insecureRandomString()}`
  await writeFile(tempFilename, contents, { encoding })
  await rename(tempFilename, filename)
}
