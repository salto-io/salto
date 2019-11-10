import { ObjectType, ElemID } from 'adapter-api'
import * as path from 'path'
import { ParseResultFSCache } from '../../src/workspace/cache'
import { SourceMap } from '../../src/parser/internal/types'
import { stat, mkdirp, writeTextFile, readTextFile } from '../../src/file'

const mockSerializedBPC = `[{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","nameParts":["dummy"]},"fields":{},"isSettings":false,"className":"ObjectType"}]
[]
[["salesforce.dummy",[{"filename":"dummy.bp","start":{"line":1,"col":1,"byte":2},"end":{"line":12,"col":3,"byte":4}}]]]`
const mockSerializedExternalBPC = `[{"annotationTypes":{},"annotations":{},"elemID":{"adapter":"salesforce","nameParts":["external"]},"fields":{},"isSettings":false,"className":"ObjectType"}]
[]
[["salesforce.external",[{"filename":"external.bp","start":{"line":1,"col":1,"byte":2},"end":{"line":12,"col":3,"byte":4}}]]]`
const mockMaliformedBPC = '[]]'
const mockLocalStorage = '.salto/local'
const mockBaseDirPath = path.join(mockLocalStorage, '.cache')
const mockWorkspaceDirPath = '/workspace/base'
const mockExternalCacheLoc = `${mockBaseDirPath}/external_bp/workspace/external/ext.bpc`
const mockMalformedCacheLoc = `${mockBaseDirPath}/external_bp/workspace/external/malformed.bpc`

jest.mock('../../src/file', () => ({
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
  writeTextFile: jest.fn(() => Promise.resolve()),
  readTextFile: jest.fn((filename: string) => {
    switch (filename) {
      case mockMalformedCacheLoc:
        return Promise.resolve(mockMaliformedBPC)
      case mockExternalCacheLoc:
        return Promise.resolve(mockSerializedExternalBPC)
      default:
        return Promise.resolve(mockSerializedBPC)
    }
  }),
}))

describe('Parse Result FS Cache', () => {
  const cache = new ParseResultFSCache(mockLocalStorage, mockWorkspaceDirPath)
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

  const extSourceMap = new SourceMap()
  const externalObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'external') })
  extSourceMap.push(new ElemID('salesforce', 'external'), {
    filename: 'external.bp',
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
  const externalParseResult = {
    elements: [externalObjectType],
    errors: [],
    sourceMap: extSourceMap,
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
      expect(writeTextFile).toHaveBeenLastCalledWith(`${mockBaseDirPath}/blabla/blurprint.bpc`, mockSerializedBPC)
    })

    it('writes a external content with the right filename', async () => {
      await cache.put({
        filename: '/workspace/external/ext.bp',
        lastModified: 0,
      }, externalParseResult)
      expect(mkdirp).toHaveBeenCalledWith(path.dirname(mockExternalCacheLoc))
      expect(writeTextFile).toHaveBeenLastCalledWith(
        mockExternalCacheLoc, mockSerializedExternalBPC,
      )
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

    it('reads external bps', async () => {
      const parseResultFromCache = await cache.get({ filename: '/workspace/external/ext.bp',
        lastModified: 0 })
      expect(stat.notFoundAsUndefined).toHaveBeenCalledWith(mockExternalCacheLoc)
      expect(readTextFile).toHaveBeenCalledWith(mockExternalCacheLoc)
      expect(parseResultFromCache).toBeDefined()
      if (parseResultFromCache !== undefined) {
        expect(parseResultFromCache.elements[0].elemID.name).toBe(
          externalParseResult.elements[0].elemID.name
        )
        expect(parseResultFromCache.errors).toEqual([])
        expect(parseResultFromCache.sourceMap.entries())
          .toEqual(externalParseResult.sourceMap.entries())
      }
    })
    it('gracefully handles an invalid cache file content', async () => {
      const parseResultFromCache = await cache.get({ filename: '/workspace/external/malformed.bp', lastModified: 0 })
      expect(stat.notFoundAsUndefined).toHaveBeenCalledWith(mockMalformedCacheLoc)
      expect(readTextFile).toHaveBeenCalledWith(mockMalformedCacheLoc)
      expect(parseResultFromCache).toBeUndefined()
    })
  })
})
