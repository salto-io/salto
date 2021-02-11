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
import { ObjectType, ElemID, Value } from '@salto-io/adapter-api'
import { ParsedNaclFile } from '../../../src/workspace/nacl_files'
import { InMemoryRemoteMap, CreateRemoteMapParams, RemoteMap } from '../../../src/workspace/remote_map'
import { createParseResultCache, ParsedNaclFileCache } from '../../../src/workspace/nacl_files/parsed_nacl_files_cache'
import { SourceMap } from '../../../src/parser'
import { toParsedNaclFile } from '../../../src/workspace/nacl_files/nacl_files_source'

describe('ParsedNaclFileCache', () => {
  // This is the "DB" for the cache and it is currently emptied per each "it"
  let remoteMaps: Record<string, InMemoryRemoteMap<Value, string>> = {}
  const inMemoryRemoteMapsCreator = async <T, K extends string = string>(
    opts: CreateRemoteMapParams<T>,
  ): Promise<RemoteMap<T, K>> => {
    const existingRemoteMapInNamespace = remoteMaps[opts.namespace]
    if (existingRemoteMapInNamespace === undefined) {
      const newRemoteMap = new InMemoryRemoteMap<T, K>()
      remoteMaps[opts.namespace] = newRemoteMap
    }
    return remoteMaps[opts.namespace] as InMemoryRemoteMap<T, K>
  }
  let cache: ParsedNaclFileCache
  const sourceMap = new SourceMap()

  const someDateTimestamp = 553881433
  const afterTimestamp = someDateTimestamp + 10
  const beforeTimestamp = someDateTimestamp - 10

  const filename = 'dummy.nacl'
  const mockCacheFileContent = 'content'
  const dummyObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'dummy') })
  sourceMap.push(new ElemID('salesforce', 'dummy').getFullName(), {
    filename,
    start: {
      line: 1,
      col: 1,
      byte: 2,
    },
    end: {
      line: 12,
      col: 3,
      byte: 4,
    },
  })
  const parseResultWithoutMD5 = {
    elements: [dummyObjectType],
    errors: [],
    sourceMap,
  }
  const dummyParsedKey = {
    filename,
    buffer: mockCacheFileContent,
    lastModified: beforeTimestamp,
  }
  let parsedDummy: ParsedNaclFile
  const toDeleteFilename = 'toDelete.nacl'
  const toDeleteContent = 'toDelete'
  const toDeleteObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'toDelete') })
  sourceMap.push(new ElemID('salesforce', 'toDelete').getFullName(), {
    filename: toDeleteFilename,
    start: {
      line: 1,
      col: 2,
      byte: 3,
    },
    end: {
      line: 12,
      col: 6,
      byte: 15,
    },
  })
  const toDeleteParseResult = {
    elements: [toDeleteObjectType],
    errors: [],
    sourceMap,
  }
  const toDeleteKey = {
    filename: toDeleteFilename,
    buffer: toDeleteContent,
    lastModified: someDateTimestamp,
  }
  let parsedToDelete: ParsedNaclFile

  beforeAll(async () => {
    jest.spyOn(Date, 'now').mockImplementation(() => someDateTimestamp)
    parsedDummy = await toParsedNaclFile(
      dummyParsedKey,
      parseResultWithoutMD5
    )
    parsedToDelete = await toParsedNaclFile(
      toDeleteKey,
      toDeleteParseResult
    )
  })

  beforeEach(async () => {
    cache = createParseResultCache(
      'mockCache',
      inMemoryRemoteMapsCreator,
    )
  })

  describe('put', () => {
    it('Should return the same value as inserted', async () => {
      await cache.put(
        dummyParsedKey,
        parsedDummy,
      )
      expect(await cache.get(dummyParsedKey)).toEqual(parsedDummy)
    })
  })

  describe('get', () => {
    beforeEach(async () => {
      await cache.put(
        dummyParsedKey,
        parsedDummy,
      )
    })
    it('Should get value if exists and newer', async () => {
      expect(await cache.get(dummyParsedKey)).toBeDefined()
    })

    it('Should get value if content did not change regardless of timestamp', async () => {
      expect(await cache.get({
        ...dummyParsedKey,
        lastModified: afterTimestamp,
      })).toBeDefined()
    })

    it('Should return undefined if file was not inserted', async () => {
      expect(await cache.get({
        filename: 'lala/noexist.nacl',
        buffer: mockCacheFileContent,
        lastModified: beforeTimestamp,
      })).toBeUndefined()
    })

    it('Should return undefined if content changed and timestap later', async () => {
      const newerDummyKey = {
        filename,
        buffer: 'changed',
        lastModified: afterTimestamp,
      }
      expect(await cache.get(newerDummyKey)).toBeUndefined()
    })

    it('Should return value if allowInvalid is true even if timestamp & buffer are "wrong"', async () => {
      const newerDummyKey = {
        filename,
        buffer: 'changed',
        lastModified: afterTimestamp,
      }
      expect(await cache.get(newerDummyKey, true)).toBeDefined()
    })
  })

  describe('delete', () => {
    it('Should delete by a specific key', async () => {
      await cache.put(
        toDeleteKey,
        parsedToDelete,
      )
      expect(await cache.get(toDeleteKey)).toBeDefined()
      await cache.delete(toDeleteKey.filename)
      expect(await cache.get(toDeleteKey)).toBeUndefined()
    })
  })

  describe('list', () => {
    it('Should list all filenames', async () => {
      await cache.put(
        dummyParsedKey,
        parsedDummy,
      )
      await cache.put(
        toDeleteKey,
        parsedToDelete,
      )
      const filesList = await cache.list()
      const currentFileNames = [filename, toDeleteFilename]
      expect(filesList.length).toEqual(currentFileNames.length)
      filesList.forEach(name =>
        expect(currentFileNames.includes(name)).toBeTruthy())
    })
  })

  describe('clear', () => {
    it('Should not return value for any key after clear', async () => {
      await cache.put(
        dummyParsedKey,
        parsedDummy,
      )
      await cache.put(
        toDeleteKey,
        parsedToDelete,
      )
      await cache.clear()
      expect(await cache.get(dummyParsedKey)).toBeUndefined()
      expect(await cache.get(toDeleteKey)).toBeUndefined()
    })
  })

  describe('rename', () => {
    let clearFnsBeforeRename: jest.SpyInstance<Promise<void>>[]
    beforeEach(async () => {
      await cache.put(
        dummyParsedKey,
        parsedDummy,
      )
      await cache.put(
        toDeleteKey,
        parsedToDelete,
      )
      expect(await cache.get(dummyParsedKey)).toEqual(parsedDummy)
      expect(await cache.get(toDeleteKey)).toEqual(parsedToDelete)
      clearFnsBeforeRename = Object.values(remoteMaps).map(remoteMap =>
        jest.spyOn(remoteMap, 'clear'))
      await cache.rename('newName')
    })

    it('Should return the same values before and after rename', async () => {
      expect(await cache.get(dummyParsedKey)).toEqual(parsedDummy)
      expect(await cache.get(toDeleteKey)).toEqual(parsedToDelete)
    })

    // This is impl specific but we need to check we cleared the old remoteMaps
    it('Should clear all the remoteMaps created before the rename', async () => {
      clearFnsBeforeRename.forEach(clearFn =>
        expect(clearFn).toHaveBeenCalled())
    })
  })

  describe('flush', () => {
    let remoteMapsFlushFuncs: jest.SpyInstance<Promise<void>>[]
    beforeEach(async () => {
      // Put stuff in the cache so there will be remoteMaps
      await cache.put(
        dummyParsedKey,
        parsedDummy,
      )
      await cache.put(
        toDeleteKey,
        parsedToDelete,
      )
      remoteMapsFlushFuncs = Object.values(remoteMaps).map(remoteMap =>
        jest.spyOn(remoteMap, 'flush'))
    })

    it('Should call flush on all created remoteMaps', async () => {
      await cache.flush()
      remoteMapsFlushFuncs.forEach(flushSpy =>
        expect(flushSpy).toHaveBeenCalled())
    })

    it('Should also flush deleted files remoteMaps', async () => {
      await cache.delete(dummyParsedKey.filename)
      await cache.flush()
      remoteMapsFlushFuncs.forEach(flushSpy => {
        expect(flushSpy).toHaveBeenCalled()
      })
    })
  })

  afterEach(async () => {
    remoteMaps = {}
  })
})
