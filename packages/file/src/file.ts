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
import JSZip from 'jszip'
import rimRafLib from 'rimraf'
import mkdirpLib from 'mkdirp'
import path from 'path'
import { strings } from '@salto-io/lowerdash'

const statP = promisify(fs.stat)
const readFileP = promisify(fs.readFile)
const copyFileP = promisify(fs.copyFile)
const writeFileP = promisify(fs.writeFile)
const readDirP = promisify(fs.readdir)

export const rm = promisify(rimRafLib)
export const mkdirp = promisify(mkdirpLib)
export const rename = promisify(fs.rename)

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

export const stat = (filename: string): Promise<fs.Stats> => statP(filename)
export const { statSync } = fs

stat.notFoundAsUndefined = notFoundAsUndefined(stat)

export const isSubDirectory = (
  subFolder: string,
  folder: string
): boolean => {
  const relative = path.relative(folder, subFolder)
  return !relative.startsWith('..') && !path.isAbsolute(relative)
}

export const readDir = async (
  dirPath: string
): Promise<string[]> => readDirP(dirPath)

export const isEmptyDir = async (
  dirPath: string
): Promise<boolean> => (await readDir(dirPath)).length === 0

export const { existsSync } = fs

export const exists = async (
  filename: string
): Promise<boolean> => (await stat.notFoundAsUndefined(filename)) !== undefined

export const readTextFileSync = (
  filename: string,
): string => fs.readFileSync(filename, 'utf8')

export const readTextFile = (
  filename: string,
): Promise<string> => readFileP(filename, { encoding: 'utf8' })

export const readZipFile = async (
  zipFilename: string,
  filename: string,
): Promise<string | undefined> => {
  const data = await readFileP(zipFilename)
  const zip = await JSZip.loadAsync(data)
  const zipFile = zip.file(filename)
  if (zipFile === null) {
    return undefined
  }
  return zipFile.async('string')
}

readTextFile.notFoundAsUndefined = notFoundAsUndefined(readTextFile)

export const readFile = (filename: string): Promise<Buffer> => readFileP(filename)

readFile.notFoundAsUndefined = notFoundAsUndefined(readFile)

export const writeFile = (
  filename: string,
  contents: Buffer | string,
): Promise<void> => writeFileP(filename, contents, { encoding: 'utf8' })

export const generateZipBuffer = async (filename: string, contents: string | Buffer):
  Promise<Buffer> => {
  const zip = new JSZip()
  zip.file(filename, contents)
  const zipContent = await zip.generateAsync({ type: 'nodebuffer' })
  return zipContent
}

export const writeZipFile = async (
  zipFilename: string,
  filename: string,
  contents: Buffer | string,
): Promise<void> => {
  const zipContent = await generateZipBuffer(filename, contents)
  await writeFile(zipFilename, zipContent)
}

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
  contents: Buffer | string,
): Promise<void> => {
  const tempFilename = `${filename}.tmp.${strings.insecureRandomString()}`
  await writeFile(tempFilename, contents)
  await rename(tempFilename, filename)
}
