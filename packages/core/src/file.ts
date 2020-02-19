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
import rimRafLib from 'rimraf'
import mkdirpLib from 'mkdirp'
import { strings } from '@salto-io/lowerdash'

const statP = promisify(fs.stat)
const readFileP = promisify(fs.readFile)
const copyFileP = promisify(fs.copyFile)
const writeFileP = promisify(fs.writeFile)
const renameP = promisify(fs.rename)

export const rm = promisify(rimRafLib)
export const mkdirp = promisify(mkdirpLib)

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

export type Stats = fs.Stats
export const stat = (filename: string): Promise<fs.Stats> => statP(filename)

stat.notFoundAsUndefined = notFoundAsUndefined(stat)

export const exists = async (
  filename: string
): Promise<boolean> => (await stat.notFoundAsUndefined(filename)) !== undefined

export const readTextFile = (
  filename: string,
): Promise<string> => readFileP(filename, { encoding: 'utf8' })

readTextFile.notFoundAsUndefined = notFoundAsUndefined(readTextFile)

export const readFile = (filename: string): Promise<Buffer> => readFileP(filename)

readFile.notFoundAsUndefined = notFoundAsUndefined(readFile)

export const writeFile = (
  filename: string,
  contents: Buffer | string,
): Promise<void> => writeFileP(filename, contents, { encoding: 'utf8' })

export const appendTextFile = (
  filename: string,
  contents: string,
): Promise<void> => writeFileP(filename, contents, { flag: 'a' })

export const copyFile: (
  sourcePath: string,
  destPath: string,
) => Promise<void> = copyFileP

export const replaceContents = async (
  filename: string,
  contents: Buffer | string
): Promise<void> => {
  const tempFilename = `${filename}.tmp.${strings.insecureRandomString()}`
  await writeFile(tempFilename, contents)
  await renameP(tempFilename, filename)
}
