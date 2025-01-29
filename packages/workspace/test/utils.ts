/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { StaticFile, calculateStaticFileHash, isObjectType, TypeElement } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { parser } from '@salto-io/parser'
import { StaticFilesSource, MissingStaticFile } from '../src/workspace/static_files/common'
import { File } from '../src/workspace/dir_store'
import { RemoteMap } from '../src/workspace/remote_map'

const { awu } = collections.asynciterable
const { isDefined } = values

export class TestFuncImpl extends parser.FunctionExpression {}

export const mockStaticFilesSource = (staticFiles: StaticFile[] = []): StaticFilesSource => ({
  load: jest.fn().mockResolvedValue([]),
  getStaticFile: jest
    .fn()
    .mockImplementation(
      (args: { filepath: string }) =>
        staticFiles.find(sf => sf.filepath === args.filepath) ?? new MissingStaticFile(args.filepath),
    ),
  getContent: jest
    .fn()
    .mockImplementation(
      async (filepath: string) => (await staticFiles.find(sf => sf.filepath === filepath)?.getContent()) ?? undefined,
    ),
  persistStaticFile: jest.fn().mockReturnValue([]),
  flush: jest.fn(),
  clone: jest.fn(),
  rename: jest.fn(),
  getTotalSize: jest.fn(),
  clear: jest.fn(),
  delete: jest.fn(),
  isPathIncluded: jest
    .fn()
    .mockImplementation(filePath => staticFiles.find(f => f.filepath === filePath) !== undefined),
})

const defaultContent = 'ZOMG'
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

export const getFieldsAndAnnoTypes = async (type: TypeElement, touched: string[] = []): Promise<TypeElement[]> => {
  const fieldTypes = isObjectType(type)
    ? await awu(Object.values(type.fields))
        .map(f => f.getType())
        .toArray()
    : []
  const annoTypes = Object.values(await type.getAnnotationTypes())

  return awu([...fieldTypes, ...annoTypes])
    .flatMap(async nestedType => {
      if (touched.includes(nestedType.elemID.getFullName())) {
        return [undefined]
      }
      touched.push(nestedType.elemID.getFullName())
      return [nestedType, ...(await getFieldsAndAnnoTypes(nestedType, touched))]
    })
    .filter(isDefined)
    .toArray()
}

export const createMockRemoteMap = <T>(): MockInterface<RemoteMap<T>> => ({
  delete: mockFunction<RemoteMap<T>['delete']>(),
  get: mockFunction<RemoteMap<T>['get']>(),
  getMany: mockFunction<RemoteMap<T>['getMany']>(),
  has: mockFunction<RemoteMap<T>['has']>(),
  set: mockFunction<RemoteMap<T>['set']>(),
  setAll: mockFunction<RemoteMap<T>['setAll']>(),
  deleteAll: mockFunction<RemoteMap<T>['deleteAll']>(),
  entries: mockFunction<RemoteMap<T>['entries']>(),
  keys: mockFunction<RemoteMap<T>['keys']>(),
  values: mockFunction<RemoteMap<T>['values']>(),
  flush: mockFunction<RemoteMap<T>['flush']>(),
  clear: mockFunction<RemoteMap<T>['clear']>(),
  close: mockFunction<RemoteMap<T>['close']>(),
  isEmpty: mockFunction<RemoteMap<T>['isEmpty']>(),
})
