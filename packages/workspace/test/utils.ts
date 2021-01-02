/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { Value, StaticFile, calculateStaticFileHash } from '@salto-io/adapter-api'
import { Functions, FunctionImplementation, FunctionExpression } from '../src/parser/functions'
import { StaticFilesSource } from '../src/workspace/static_files/common'
import { File } from '../src/workspace/dir_store'

export class TestFuncImpl extends FunctionExpression {}

const registerFunction = (
  funcName: string,
  func: FunctionImplementation,
  functions: Functions = {},
  aliases: string[] = [],
): Functions => ({
  ...functions,
  ...[funcName].concat(aliases).reduce((acc, alias: string) => ({
    ...acc,
    ...{
      [alias]: func,
    },
  }), {}),
})

export const registerTestFunction = (
  funcName: string,
  aliases: string[] = [],
  functions: Functions = {}
): Functions => (
  registerFunction(
    funcName,
    {
      parse: (parameters: Value[]) => Promise.resolve(new TestFuncImpl(funcName, parameters)),
      dump: (val: Value) => Promise.resolve(new FunctionExpression(
        funcName,
        val.parameters,
      )),
      isSerializedAsFunction: (val: Value) => val instanceof TestFuncImpl,
    },
    functions,
    aliases,
  )
)

export const mockStaticFilesSource = (): StaticFilesSource => ({
  getStaticFile: jest.fn(),
  getContent: jest.fn(),
  persistStaticFile: jest.fn().mockReturnValue([]),
  flush: jest.fn(),
  clone: jest.fn(),
  rename: jest.fn(),
  getTotalSize: jest.fn(),
  clear: jest.fn(),
  delete: jest.fn(),
})

export const defaultContent = 'ZOMG'
const defaultPath = 'path'
export const defaultBuffer = Buffer.from(defaultContent)
export const defaultFile: File<Buffer> = { filename: defaultPath, buffer: defaultBuffer }

export const hashedContent = calculateStaticFileHash(defaultBuffer)

export const exampleStaticFileWithHash = new StaticFile({
  filepath: defaultPath,
  hash: hashedContent,
})
export const exampleStaticFileWithContent = new StaticFile({
  filepath: defaultPath,
  content: defaultBuffer,
})
