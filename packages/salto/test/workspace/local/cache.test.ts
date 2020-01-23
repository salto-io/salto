import * as path from 'path'
import { ObjectType, ElemID } from 'adapter-api'
import { localParseResultCache } from '../../../src/workspace/local/cache'
import { SourceMap } from '../../../src/parser/internal/types'
import { stat, mkdirp, replaceContents, readTextFile, exists } from '../../../src/file'


jest.mock('../../../src/file')
describe('localParseResultCache', () => {
  const mockBaseDirPath = '.salto/local/.cache'
  const mockStateNotFoundAsUndefine = stat.notFoundAsUndefined as unknown as jest.Mock
  const mockState = stat as unknown as jest.Mock
  const mockFileExists = exists as jest.Mock
  const mockReadFile = readTextFile as unknown as jest.Mock
  const mockReplaceContents = replaceContents as jest.Mock
  const mockMkdir = mkdirp as jest.Mock

  const cache = localParseResultCache(mockBaseDirPath)
  const sourceMap = new SourceMap()
  const dummyObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'dummy') })
  sourceMap.push(new ElemID('salesforce', 'dummy'), {
    filename: 'dummy.bp',
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
  const mockSerializedBPC = `[{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","typeName":"dummy","idType":"type","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"}]
[]
[["salesforce.dummy",[{"filename":"dummy.bp","start":{"line":1,"col":1,"byte":2},"end":{"line":12,"col":3,"byte":4}}]]]`


  beforeEach(() => {
    jest.clearAllMocks()
    mockStateNotFoundAsUndefine.mockResolvedValue({ mtimeMs: 1000 })
    mockState.mockResolvedValue({ mtimeMs: 1000 })
    mockFileExists.mockResolvedValue(false)
    mockReadFile.mockResolvedValue(mockSerializedBPC)
    mockReplaceContents.mockResolvedValue(true)
    mockMkdir.mockResolvedValue(true)
  })

  describe('put', () => {
    it('writes a content with the right filename', async () => {
      await cache.put({
        filename: 'blabla/blurprint.bp',
        lastModified: 0,
      }, parseResult)
      expect(mkdirp).not.toHaveBeenCalled()
      expect(replaceContents).not.toHaveBeenCalled()
      await cache.flush()
      expect(mkdirp).toHaveBeenCalledWith(path.resolve(mockBaseDirPath, 'blabla'))
      expect(replaceContents).toHaveBeenLastCalledWith(
        path.resolve(mockBaseDirPath, 'blabla/blurprint.bpc'), mockSerializedBPC
      )
    })
  })
  describe('get', () => {
    it('tries to read the file if exists and newer', async () => {
      mockFileExists.mockResolvedValueOnce(true)
      const parseResultFromCache = await cache.get({ filename: 'blabla/blurprint3.bp', lastModified: 0 })
      expect(parseResultFromCache).toBeDefined()
      const expectedCacheFileName = path.resolve(mockBaseDirPath, 'blabla/blurprint3.bpc')
      expect(stat.notFoundAsUndefined).toHaveBeenCalledWith(expectedCacheFileName)
      expect(readTextFile).toHaveBeenCalledWith(expectedCacheFileName)
      // hack to make compiler happy :(
      if (parseResultFromCache !== undefined) {
        expect(parseResultFromCache.elements[0].elemID.name).toBe(
          parseResult.elements[0].elemID.name
        )
        expect(parseResultFromCache.errors).toEqual([])
        expect(parseResultFromCache.sourceMap.entries()).toEqual(parseResult.sourceMap.entries())
      }
    })

    it('does not return the file if it does not exist', async () => {
      const expectedCacheFileName = path.resolve(mockBaseDirPath, 'blabla/notexist.bpc')
      const parseResultFromCache = await cache.get({ filename: 'blabla/notexist.bp', lastModified: 0 })
      expect(exists).toHaveBeenLastCalledWith(expectedCacheFileName)
      expect(readTextFile).not.toHaveBeenCalled()
      expect(parseResultFromCache).toBeUndefined()
    })

    it('does not return the file if it bp timestamp is later', async () => {
      mockFileExists.mockResolvedValueOnce(true)
      const parseResultFromCache = await cache.get({ filename: 'blabla/blurprint2.bp', lastModified: 4000 })
      const expectedCacheFileName = path.resolve(mockBaseDirPath, 'blabla/blurprint2.bpc')
      expect(stat.notFoundAsUndefined).toHaveBeenLastCalledWith(expectedCacheFileName)
      expect(readTextFile).not.toHaveBeenCalled()
      expect(parseResultFromCache).toBeUndefined()
    })
    it('gracefully handles an invalid cache file content', async () => {
      mockReadFile.mockResolvedValueOnce('[]]')
      const parseResultFromCache = await cache.get({ filename: 'blabla/malformed.bp', lastModified: 0 })
      const mockMalformedCacheLoc = path.resolve(mockBaseDirPath, 'blabla/malformed.bpc')
      expect(stat.notFoundAsUndefined).toHaveBeenCalledWith(mockMalformedCacheLoc)
      expect(readTextFile).toHaveBeenCalledWith(mockMalformedCacheLoc)
      expect(parseResultFromCache).toBeUndefined()
    })
  })
})
