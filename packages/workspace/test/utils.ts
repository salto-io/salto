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
import { RemoteMap, RemoteMapEntry, CreateRemoteMapParams, RemoteMapCreator } from '../src/workspace/remote_map'

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

export const persistentMockCreateRemoteMap = (): RemoteMapCreator => {
  const maps = {} as Record<string, Record<string, string>>
  const creator = async <T, K extends string = string>(
    opts: CreateRemoteMapParams<T>
  ): Promise<RemoteMap<T, K>> => {
    if (maps[opts.namespace] === undefined) {
      maps[opts.namespace] = {} as Record<string, string>
    }
    return {
      setAll: async (
        entries: collections.asynciterable.ThenableIterable<RemoteMapEntry<T, K>>
      ): Promise<void> => {
        for await (const entry of entries) {
          maps[opts.namespace][entry.key] = opts.serialize(entry.value)
        }
      },
      delete: async (key: K) => {
        delete maps[opts.namespace][key]
      },
      get: async (key: K): Promise<T | undefined> => {
        const value = maps[opts.namespace][key]
        return value ? opts.deserialize(value) : undefined
      },
      has: async (key: K): Promise<boolean> => key in maps[opts.namespace],
      set: async (key: K, value: T): Promise<void> => {
        maps[opts.namespace][key] = opts.serialize(value)
      },
      clear: async (): Promise<void> => {
        maps[opts.namespace] = {} as Record<K, string>
      },
      entries: (): AsyncIterable<RemoteMapEntry<T, K>> =>
        awu(Object.entries(maps[opts.namespace]))
          .map(async ([key, value]) =>
            ({ key: key as K, value: await opts.deserialize(value as string) })),
      keys: (): AsyncIterable<K> => toAsyncIterable(
        Object.keys(maps[opts.namespace]) as unknown as K[]
      ),
      values: (): AsyncIterable<T> =>
        awu(Object.values(maps[opts.namespace])).map(async v => opts.deserialize(v as string)),
      flush: (): Promise<void> => Promise.resolve(undefined),
      revert: (): Promise<void> => Promise.resolve(undefined),
      close: (): Promise<void> => Promise.resolve(undefined),
    }
  }
  return creator
}

export const mockCreateRemoteMap = async <T, K extends string = string>(
  opts: CreateRemoteMapParams<T>
): Promise<RemoteMap<T, K>> => {
  let data: Record<K, string> = {} as Record<K, string>
  return {
    setAll: async (
      entries: collections.asynciterable.ThenableIterable<RemoteMapEntry<T, K>>
    ): Promise<void> => {
      for await (const entry of entries) {
        data[entry.key] = opts.serialize(entry.value)
      }
    },
    delete: async (key: K) => {
      delete data[key]
    },
    get: async (key: K): Promise<T | undefined> => {
      const value = data[key]
      return value ? opts.deserialize(value) : undefined
    },
    has: async (key: K): Promise<boolean> => key in data,
    set: async (key: K, value: T): Promise<void> => {
      data[key] = opts.serialize(value)
    },
    clear: async (): Promise<void> => {
      data = {} as Record<K, string>
    },
    entries: (): AsyncIterable<RemoteMapEntry<T, K>> =>
      awu(Object.entries(data))
        .map(async ([key, value]) =>
          ({ key: key as K, value: await opts.deserialize(value as string) })),
    keys: (): AsyncIterable<K> => toAsyncIterable(Object.keys(data) as unknown as K[]),
    values: (): AsyncIterable<T> =>
      awu(Object.values(data)).map(async v => opts.deserialize(v as string)),
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
