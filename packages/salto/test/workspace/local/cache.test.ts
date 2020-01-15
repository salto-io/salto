import { ObjectType, ElemID } from 'adapter-api'
import { localParseResultCache } from '../../../src/workspace/local/cache'
import { SourceMap } from '../../../src/parser/internal/types'
import { stat, mkdirp, writeFile, readTextFile } from '../../../src/file'

const mockSerializedBPC = `[{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","typeName":"dummy","idType":"type","nameParts":[]},"fields":{},"isSettings":false,"_salto_class":"ObjectType"}]
[]
[["salesforce.dummy",[{"filename":"dummy.bp","start":{"line":1,"col":1,"byte":2},"end":{"line":12,"col":3,"byte":4}}]]]`
const mockMaliformedBPC = '[]]'
const mockBaseDirPath = '.salto/local/.cache'
const mockMalformedCacheLoc = `${mockBaseDirPath}/blabla/malformed.bpc`

jest.mock('../../../src/file', () => ({
  mkdirp: jest.fn(() => Promise.resolve()),
  stat: {
    notFoundAsUndefined: jest.fn((
      filename: string
    ): Promise<{ mtimeMs: number } | undefined> => Promise.resolve(
      filename !== `${mockBaseDirPath}/blabla/notexist.bpc`
        ? { mtimeMs: 1000 }
        : undefined
    )),
  },
  writeFile: jest.fn(() => Promise.resolve()),
  readTextFile: jest.fn((filename: string) => {
    switch (filename) {
      case mockMalformedCacheLoc:
        return Promise.resolve(mockMaliformedBPC)
      default:
        return Promise.resolve(mockSerializedBPC)
    }
  }),
}))

describe('localParseResultCache', () => {
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

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('put', () => {
    it('writes a content with the right filename', async () => {
      await cache.put({
        filename: 'blabla/blurprint.bp',
        lastModified: 0,
      }, parseResult)
      expect(mkdirp).toHaveBeenCalledWith(`${mockBaseDirPath}/blabla`)
      expect(writeFile).toHaveBeenLastCalledWith(`${mockBaseDirPath}/blabla/blurprint.bpc`, mockSerializedBPC)
    })
  })
  describe('get', () => {
    it('tries to read the file if exists and newer', async () => {
      await cache.get({ filename: 'blabla/blurprint.bp', lastModified: 0 })
      const parseResultFromCache = await cache.get({ filename: 'blabla/blurprint.bp', lastModified: 0 })
      const expectedCacheFileName = `${mockBaseDirPath}/blabla/blurprint.bpc`
      expect(stat.notFoundAsUndefined).toHaveBeenCalledWith(expectedCacheFileName)
      expect(readTextFile).toHaveBeenCalledWith(expectedCacheFileName)
      expect(parseResultFromCache).toBeDefined()
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
      const parseResultFromCache = await cache.get({ filename: 'blabla/notexist.bp', lastModified: 0 })
      const expectedCacheFileName = `${mockBaseDirPath}/blabla/notexist.bpc`
      expect(stat.notFoundAsUndefined).toHaveBeenLastCalledWith(expectedCacheFileName)
      expect(readTextFile).not.toHaveBeenCalled()
      expect(parseResultFromCache).toBeUndefined()
    })

    it('does not return the file if it bp timestamp is later', async () => {
      const parseResultFromCache = await cache.get({ filename: 'blabla/blurprint2.bp', lastModified: 4000 })
      const expectedCacheFileName = `${mockBaseDirPath}/blabla/blurprint2.bpc`
      expect(stat.notFoundAsUndefined).toHaveBeenLastCalledWith(expectedCacheFileName)
      expect(readTextFile).not.toHaveBeenCalled()
      expect(parseResultFromCache).toBeUndefined()
    })
    it('gracefully handles an invalid cache file content', async () => {
      const parseResultFromCache = await cache.get({ filename: 'blabla/malformed.bp', lastModified: 0 })
      expect(stat.notFoundAsUndefined).toHaveBeenCalledWith(mockMalformedCacheLoc)
      expect(readTextFile).toHaveBeenCalledWith(mockMalformedCacheLoc)
      expect(parseResultFromCache).toBeUndefined()
    })
  })
})
