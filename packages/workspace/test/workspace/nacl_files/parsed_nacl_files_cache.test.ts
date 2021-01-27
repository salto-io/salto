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
import { createParseResultCache } from '../../../src/workspace/nacl_files/parsed_nacl_files_cache'
import { StaticFilesSource } from '../../../src/workspace/static_files'
import { SourceMap } from '../../../src/parser'
import { toParsedNaclFile } from '../../../src/workspace/nacl_files/nacl_files_source'

describe('ParsedNaclFileCache', () => {
  const mockedStaticFilesSource = { clone: jest.fn() } as unknown as StaticFilesSource
  const remoteMaps: Record<string, InMemoryRemoteMap<Value, string>> = {}
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

  const cache = createParseResultCache(
    'mockCache',
    inMemoryRemoteMapsCreator,
    mockedStaticFilesSource
  )
  const filename = 'dummy.nacl'
  const sourceMap = new SourceMap()
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

  const mockCacheFileContent = 'content'
  const parseResultWithoutMD5 = {
    elements: [dummyObjectType],
    errors: [],
    sourceMap,
  }

  let parsedNaclFile: ParsedNaclFile
  const someDateTimestamp = 553881433
  const afterTimestamp = someDateTimestamp + 10
  const beforeTimestamp = someDateTimestamp - 10
  const dummyParsedKey = {
    filename,
    buffer: mockCacheFileContent,
    lastModified: beforeTimestamp,
  }
  beforeAll(async () => {
    jest.spyOn(Date, 'now').mockImplementation(() => someDateTimestamp)
    parsedNaclFile = await toParsedNaclFile(
      dummyParsedKey,
      parseResultWithoutMD5
    )
  })

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  describe('put', () => {
    it('Should return the same value as inserted', async () => {
      await cache.put(
        dummyParsedKey,
        parsedNaclFile,
      )
      expect(await cache.get(dummyParsedKey)).toEqual(parsedNaclFile)
    })
  })

  describe('get', () => {
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
})
