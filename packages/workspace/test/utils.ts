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
import { Value, StaticFile, calculateStaticFileHash, ObjectType, isObjectType, TypeElement } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { Functions, FunctionImplementation, FunctionExpression } from '../src/parser/functions'
import { StaticFilesSource } from '../src/workspace/static_files/common'
import { File } from '../src/workspace/dir_store'
import { RemoteMap, RemoteMapEntry, CreateRemoteMapParams } from '../src/workspace/remote_map'

const { awu, toAsyncIterable } = collections.asynciterable
const { isDefined } = values

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

export const mockCreateRemoteMap = async <T>(opts: CreateRemoteMapParams<T>):
Promise<RemoteMap<T>> => {
  let data: Record<string, string> = {}
  return {
    setAll: async (
      entries: collections.asynciterable.ThenableIterable<RemoteMapEntry<T, string>>
    ): Promise<void> => {
      for await (const entry of entries) {
        data[entry.key] = opts.serialize(entry.value)
      }
    },
    delete: async (key: string) => {
      delete data[key]
    },
    get: async (key: string): Promise<T | undefined> => {
      const value = data[key]
      return value ? opts.deserialize(value) : undefined
    },
    has: async (key: string): Promise<boolean> => key in data,
    set: async (key: string, value: T): Promise<void> => {
      data[key] = opts.serialize(value)
    },
    clear: async (): Promise<void> => {
      data = {}
    },
    entries: (): AsyncIterable<RemoteMapEntry<T, string>> =>
      awu(Object.entries(data))
        .map(async e =>
          ({ key: e[0], value: await opts.deserialize(e[1] as unknown as string) })),
    keys: (): AsyncIterable<string> => toAsyncIterable(Object.keys(data)),
    values: (): AsyncIterable<T> =>
      awu(Object.values(data)).map(async v => opts.deserialize(v)),
    flush: (): Promise<void> => Promise.resolve(undefined),
    revert: (): Promise<void> => Promise.resolve(undefined),
    close: (): Promise<void> => Promise.resolve(undefined),
  }
}

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

export const getFieldsAndAnnoTypes = async (
  objType: ObjectType,
  touched: string[] = []
): Promise<TypeElement[]> => {
  const fieldTypes = await awu(Object.values(objType.fields)).map(f => f.getType()).toArray()
  const annoTypes = Object.values(await objType.getAnnotationTypes())

  return awu([...fieldTypes, ...annoTypes]).flatMap(async type => {
    if (touched.includes(type.elemID.getFullName())) {
      return [undefined]
    }
    touched.push(type.elemID.getFullName())
    if (!isObjectType(type)) {
      return [type]
    }
    return [type, ...await getFieldsAndAnnoTypes(type, touched)]
  }).filter(isDefined)
    .toArray()
}
