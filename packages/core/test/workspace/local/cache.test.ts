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
import * as path from 'path'
import { ObjectType, ElemID } from '@salto-io/adapter-api'
import { stat, mkdirp, replaceContents, readFile, exists } from '@salto-io/file'
import { parseCache, parser, staticFiles } from '@salto-io/workspace'
import { localDirectoryStore } from '../../../src/local-workspace/dir_store'

const { parseResultCache } = parseCache
type SourceMap = parser.SourceMap

jest.mock('@salto-io/file', () => ({
  ...jest.requireActual('@salto-io/file'),
  stat: jest.fn(),
  exists: jest.fn(),
  readFile: jest.fn(),
  replaceContents: jest.fn(),
  mkdirp: jest.fn(),
}))

jest.mock('@salto-io/workspace', () => ({
  ...jest.requireActual('@salto-io/workspace'),
  serialize: jest.fn(),
}))

describe('localParseResultCache', () => {
  const mockBaseDirPath = '.salto/local/cache'
  stat.notFoundAsUndefined = jest.fn()
  const mockStatNotFoundAsUndefined = stat.notFoundAsUndefined as unknown as jest.Mock
  const mockStat = stat as unknown as jest.Mock
  const mockFileExists = exists as jest.Mock
  const mockReadFile = readFile as unknown as jest.Mock
  const mockReplaceContents = replaceContents as jest.Mock
  const mockMkdir = mkdirp as jest.Mock
  const mockedStaticFilesSource = { clone: jest.fn() } as unknown as staticFiles.StaticFilesSource
  const cache = parseResultCache(localDirectoryStore(mockBaseDirPath), mockedStaticFilesSource)
  const sourceMap = new parser.SourceMap()
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
    mockStatNotFoundAsUndefined.mockResolvedValue({ mtimeMs: 1000 })
    mockStat.mockResolvedValue({ mtimeMs: 1000 })
    mockFileExists.mockResolvedValue(false)
    mockReadFile.mockResolvedValue(mockSerializedCacheFile)
    mockReplaceContents.mockResolvedValue(true)
    mockMkdir.mockResolvedValue(true)
  })

  describe('put', () => {
    it('writes a content with the right filename', async () => {
      await cache.put({
        filename: 'blabla/blurprint.nacl',
        lastModified: 0,
      }, parseResult)
      expect(mkdirp).not.toHaveBeenCalled()
      expect(replaceContents).not.toHaveBeenCalled()
      await cache.flush()
      expect(mkdirp).toHaveBeenCalledWith(path.resolve(mockBaseDirPath, 'blabla'))
      expect(replaceContents).toHaveBeenLastCalledWith(
        path.resolve(mockBaseDirPath, 'blabla/blurprint.jsonl'), mockSerializedCacheFile
      )
    })
  })
  describe('get', () => {
    it('tries to read the file if exists and newer', async () => {
      mockFileExists.mockResolvedValueOnce(true)
      const parseResultFromCache = await cache.get({ filename: 'blabla/blurprint3.nacl', lastModified: 0 })
      expect(parseResultFromCache).toBeDefined()
      const expectedCacheFileName = path.resolve(mockBaseDirPath, 'blabla/blurprint3.jsonl')
      expect(stat.notFoundAsUndefined).toHaveBeenCalledWith(expectedCacheFileName)
      expect(readFile).toHaveBeenCalledWith(expectedCacheFileName)
      // hack to make compiler happy :(
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
      const expectedCacheFileName = path.resolve(mockBaseDirPath, 'blabla/notexist.jsonl')
      const parseResultFromCache = await cache.get({ filename: 'blabla/notexist.nacl', lastModified: 0 })
      expect(exists).toHaveBeenLastCalledWith(expectedCacheFileName)
      expect(readFile).not.toHaveBeenCalled()
      expect(parseResultFromCache).toBeUndefined()
    })

    it('does not return the file if it nacl file timestamp is later', async () => {
      mockFileExists.mockResolvedValueOnce(true)
      const parseResultFromCache = await cache.get({ filename: 'blabla/blurprint2.nacl', lastModified: 4000 })
      const expectedCacheFileName = path.resolve(mockBaseDirPath, 'blabla/blurprint2.jsonl')
      expect(stat.notFoundAsUndefined).toHaveBeenLastCalledWith(expectedCacheFileName)
      expect(readFile).not.toHaveBeenCalled()
      expect(parseResultFromCache).toBeUndefined()
    })
    it('gracefully handles an invalid cache file content', async () => {
      mockReadFile.mockResolvedValueOnce('[]]')
      const parseResultFromCache = await cache.get({ filename: 'blabla/malformed.nacl', lastModified: 0 })
      const mockMalformedCacheLoc = path.resolve(mockBaseDirPath, 'blabla/malformed.jsonl')
      expect(stat.notFoundAsUndefined).toHaveBeenCalledWith(mockMalformedCacheLoc)
      expect(readFile).toHaveBeenCalledWith(mockMalformedCacheLoc)
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
