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
import wu from 'wu'
import { ObjectType, ElemID } from '@salto-io/adapter-api'
import { mockDirStore } from '../common/nacl_file_store'
import { parseResultCache } from '../../src/workspace/cache'
import * as serializer from '../../src/serializer/elements'
import { StaticFilesSource } from '../../src/workspace/static_files'
import { SourceMap } from '../../src/parser'

describe('parseResultCache', () => {
  const mockedStaticFilesSource = { clone: jest.fn() } as unknown as StaticFilesSource
  const dirStore = mockDirStore()
  const dirStoreGet = dirStore.get as jest.Mock
  const dirStoreMtimestamp = dirStore.mtimestamp as jest.Mock
  const cache = parseResultCache(dirStore, mockedStaticFilesSource)
  const sourceMap = new SourceMap()
  const dummyObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'dummy') })
  sourceMap.push(new ElemID('salesforce', 'dummy').getFullName(), {
    filename: 'dummy.nacl',
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
  const parseResult = {
    elements: [dummyObjectType],
    errors: [],
    sourceMap,
  }
  const mockSerializedCacheFile = `[{"elemID":{"adapter":"salesforce","typeName":"dummy","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"fields":{},"isSettings":false,"_salto_class":"ObjectType"}]
[]
[["salesforce.dummy",[{"filename":"dummy.nacl","start":{"line":1,"col":1,"byte":2},"end":{"line":12,"col":3,"byte":4}}]]]`

  beforeEach(() => {
    jest.clearAllMocks()
    dirStoreGet.mockResolvedValue(undefined)
    dirStoreMtimestamp.mockResolvedValue(0)
  })

  describe('put', () => {
    it('writes a content with the right filename', async () => {
      await cache.put({
        filename: 'blabla/blurprint.nacl',
        lastModified: 0,
      }, parseResult)
      expect(dirStore.set as jest.Mock)
        .toHaveBeenCalledWith({ filename: 'blabla/blurprint.jsonl', buffer: mockSerializedCacheFile })
    })

    it('serializes with cache mode', async () => {
      jest.spyOn(serializer, 'serialize')
      await cache.put({
        filename: 'blabla/blurprint.nacl',
        lastModified: 0,
      }, parseResult)
      expect((serializer.serialize as jest.Mock).mock.calls.length).toBe(1)
      expect((serializer.serialize as jest.Mock).mock.calls[0][1]).toEqual('keepRef')
    })
  })

  describe('get', () => {
    it('tries to read the file if exists and newer', async () => {
      dirStoreGet.mockResolvedValue({ buffer: mockSerializedCacheFile })
      dirStoreMtimestamp.mockResolvedValue(1)
      const parseResultFromCache = await cache
        .get({ filename: 'blabla/blurprint3.nacl', lastModified: 0 })
      expect(parseResultFromCache).toBeDefined()
      if (parseResultFromCache !== undefined) {
        expect(parseResultFromCache.elements[0].elemID.name).toBe(
          parseResult.elements[0].elemID.name
        )
        expect(parseResultFromCache.errors).toEqual([])
        expect(parseResultFromCache.sourceMap).toBeDefined()
        const sm = parseResultFromCache.sourceMap as SourceMap
        expect(
          wu(sm.entries()).toArray()
        ).toEqual(
          wu(parseResult.sourceMap.entries()).toArray()
        )
      }
    })

    it('does not return the file if it does not exist', async () => {
      dirStoreGet.mockResolvedValue(undefined)
      dirStoreMtimestamp.mockResolvedValue(1)
      const parseResultFromCache = await cache
        .get({ filename: 'blabla/notexist.nacl', lastModified: 0 })
      expect(parseResultFromCache).toBeUndefined()
    })

    it('does not return the file if it nacl file timestamp is later', async () => {
      (dirStore.mtimestamp as jest.Mock).mockResolvedValue(4000)
      const parseResultFromCache = await cache
        .get({ filename: 'blabla/blurprint2.nacl', lastModified: 4000 })
      expect(parseResultFromCache).toBeUndefined()
    })

    it('gracefully handles an invalid cache file content', async () => {
      dirStoreGet.mockResolvedValue({ buffer: '[]]' })
      dirStoreMtimestamp.mockResolvedValue(1)
      const parseResultFromCache = await cache
        .get({ filename: 'blabla/malformed.nacl', lastModified: 0 })
      expect(parseResultFromCache).toBeUndefined()
    })
  })
  describe('clone', () => {
    it('should static files store', () => {
      cache.clone()
      expect(mockedStaticFilesSource.clone).toHaveBeenCalledTimes(1)
    })
  })
})
