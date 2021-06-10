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
import { ObjectType, ElemID } from '@salto-io/adapter-api'
import { hash } from '@salto-io/lowerdash'
import { mockDirStore } from '../common/nacl_file_store'
import { parseResultCache } from '../../src/workspace/cache'
import * as serializer from '../../src/serializer/elements'
import { StaticFilesSource } from '../../src/workspace/static_files'
import { SourceMap } from '../../src/parser'

describe('parseResultCache', () => {
  const mockedStaticFilesSource = { clone: jest.fn() } as unknown as StaticFilesSource
  const dirStore = mockDirStore()
  const dirStoreGet = dirStore.get as jest.Mock
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

  const mockCacheFileContent = 'content'
  const mockCacheFileMD5 = hash.toMD5(mockCacheFileContent)

  const parseResultWithoutMetadata = {
    elements: [dummyObjectType],
    errors: [],
    sourceMap,
  }

  const parseResult = {
    ...parseResultWithoutMetadata,
    metadata: { md5: mockCacheFileMD5 },
  }

  const mockSerializedCacheFileWithoutMD5 = `[{"elemID":{"adapter":"salesforce","typeName":"dummy","idType":"type","nameParts":[]},"annotations":{},"annotationTypes":{},"fields":{},"isSettings":false,"_salto_class":"ObjectType"}]
[]
[["salesforce.dummy",[{"filename":"dummy.nacl","start":{"line":1,"col":1,"byte":2},"end":{"line":12,"col":3,"byte":4}}]]]`

  const mockSerializedCacheFile = `${mockSerializedCacheFileWithoutMD5}
{"md5":"${mockCacheFileMD5}"}`

  beforeEach(() => {
    jest.clearAllMocks()
    dirStoreGet.mockResolvedValue(undefined)
  })

  describe('put', () => {
    it('writes a content with the right filename', async () => {
      await cache.put(
        { filename: 'blabla/blurprint.nacl', buffer: mockCacheFileContent },
        parseResult,
      )
      expect(dirStore.set).toHaveBeenCalledWith(
        { filename: 'blabla/blurprint.jsonl', buffer: mockSerializedCacheFile }
      )
    })

    it('serializes with cache mode', async () => {
      jest.spyOn(serializer, 'serialize')
      await cache.put(
        { filename: 'blabla/blurprint.nacl', buffer: 'buffer' },
        parseResult,
      )
      expect(serializer.serialize).toHaveBeenCalledTimes(1)
      expect(serializer.serialize).toHaveBeenCalledWith(expect.anything(), 'keepRef')
    })
  })

  describe('get', () => {
    it('does not return the file if it does not exist', async () => {
      dirStoreGet.mockResolvedValue(undefined)
      const parseResultFromCache = await cache.get(
        { filename: 'blabla/notexist.nacl', buffer: 'buffer' }
      )
      expect(parseResultFromCache).toBeUndefined()
    })

    it('does not return the file if the nacl content changed', async () => {
      dirStoreGet.mockResolvedValue({ buffer: mockSerializedCacheFile })
      const parseResultFromCache = await cache.get(
        { filename: 'blabla/blurprint2.nacl', buffer: 'buffer' }
      )
      expect(parseResultFromCache).toBeUndefined()
    })

    it('does not return the file if there is no metadata in the cache file', async () => {
      dirStoreGet.mockResolvedValue({ buffer: mockSerializedCacheFileWithoutMD5 })
      const parseResultFromCache = await cache.get(
        { filename: 'blabla/blurprint2.nacl', buffer: 'buffer' }
      )
      expect(parseResultFromCache).toBeUndefined()
    })

    it('does not return the file if key does not contain buffer', async () => {
      dirStoreGet.mockResolvedValue({ buffer: mockSerializedCacheFile })
      const parseResultFromCache = await cache.get({ filename: 'blabla/blurprint2.nacl' })
      expect(parseResultFromCache).toBeUndefined()
    })

    it('returns the file if the nacl content is the same', async () => {
      dirStoreGet.mockResolvedValue({ buffer: mockSerializedCacheFile })
      const parseResultFromCache = await cache.get(
        { filename: 'blabla/blurprint2.nacl', buffer: mockCacheFileContent }
      )
      expect(parseResultFromCache).toEqual(parseResultWithoutMetadata)
    })

    it('gracefully handles an invalid cache file content', async () => {
      dirStoreGet.mockResolvedValue({ buffer: '[]]' })
      const parseResultFromCache = await cache.get(
        { filename: 'blabla/malformed.nacl', buffer: 'buffer' }
      )
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
