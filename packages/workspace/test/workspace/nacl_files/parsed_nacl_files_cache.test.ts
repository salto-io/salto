/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ObjectType, ElemID, Value, SeverityLevel } from '@salto-io/adapter-api'
import { parser } from '@salto-io/parser'
import { ParsedNaclFile } from '../../../src/workspace/nacl_files'
import { InMemoryRemoteMap, CreateRemoteMapParams, RemoteMap } from '../../../src/workspace/remote_map'
import { createParseResultCache, ParsedNaclFileCache } from '../../../src/workspace/nacl_files/parsed_nacl_files_cache'
import { StaticFilesSource } from '../../../src/workspace/static_files'
import { toParsedNaclFile } from '../../../src/workspace/nacl_files/nacl_files_source'

describe('ParsedNaclFileCache', () => {
  const mockedStaticFilesSource = { clone: jest.fn() } as unknown as StaticFilesSource
  // This is the "DB" for the cache and it is currently emptied per each "it"
  let remoteMaps: Record<string, InMemoryRemoteMap<Value, string>> = {}
  const inMemoryRemoteMapsCreator = async <T, K extends string = string>(
    _opts: CreateRemoteMapParams<T>,
  ): Promise<RemoteMap<T, K>> => new InMemoryRemoteMap<T, K>()
  let cache: ParsedNaclFileCache
  const sourceMap = new parser.SourceMap()

  const someDateTimestamp = 553881433
  const afterTimestamp = someDateTimestamp + 10
  const beforeTimestamp = someDateTimestamp - 10

  const dummyFilename = 'dummy.nacl'
  const mockCacheFileContent = 'content'
  const mockSourceRange = {
    filename: dummyFilename,
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
  }
  const dummyObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'dummy') })
  sourceMap.push(new ElemID('salesforce', 'dummy').getFullName(), mockSourceRange)
  const parseResultWithoutMD5 = {
    elements: [dummyObjectType],
    errors: [],
    sourceMap,
  }
  const dummyParsedKey = {
    filename: dummyFilename,
    buffer: mockCacheFileContent,
    lastModified: beforeTimestamp,
  }
  let parsedDummy: ParsedNaclFile

  const dummy2Filename = 'dummy2.nacl'
  const mockCacheFileContentDummy2 = 'content2'
  const mockSourceRangeDummy2 = {
    filename: dummy2Filename,
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
  }
  const dummy2ObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'dummy2') })
  sourceMap.push(new ElemID('salesforce', 'dummy2').getFullName(), mockSourceRangeDummy2)
  const parseResultWithoutMD5Dummy2 = {
    elements: [dummy2ObjectType],
    errors: [],
    sourceMap,
  }
  const dummy2ParsedKey = {
    filename: dummy2Filename,
    buffer: mockCacheFileContentDummy2,
    lastModified: beforeTimestamp,
  }
  let parsedDummy2: ParsedNaclFile

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

  const toDelete2Filename = 'toDelete2.nacl'
  const toDelete2Content = 'toDelete2'
  const toDelete2ObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'toDelete2') })
  sourceMap.push(new ElemID('salesforce', 'toDelete2').getFullName(), {
    filename: toDelete2Filename,
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
  const toDelete2ParseResult = {
    elements: [toDelete2ObjectType],
    errors: [],
    sourceMap,
  }
  const toDelete2Key = {
    filename: toDelete2Filename,
    buffer: toDelete2Content,
    lastModified: someDateTimestamp,
  }
  let parsedToDelete2: ParsedNaclFile

  const initDummyFilename = 'initDummy.nacl'
  const mockCacheFileContentInitDummy = 'content'
  const mockSourceRangeInitDummy = {
    filename: initDummyFilename,
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
  }
  const initDummyObjectType = new ObjectType({ elemID: new ElemID('salesforce', 'initDummy') })
  sourceMap.push(new ElemID('salesforce', 'initDummy').getFullName(), mockSourceRangeInitDummy)
  const parseResultWithoutMD5InitDummy = {
    elements: [initDummyObjectType],
    errors: [],
    sourceMap,
  }
  const initDummyParsedKey = {
    filename: initDummyFilename,
    buffer: mockCacheFileContentInitDummy,
    lastModified: beforeTimestamp,
  }
  let parsedInitDummy: ParsedNaclFile

  const parsedWithoutBuffer = (parsed: ParsedNaclFile): ParsedNaclFile => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { buffer, ...parsedWithoutBuff } = parsed
    return parsedWithoutBuff
  }

  const fileExistsInCache = async (filename: string): Promise<boolean> =>
    (await (await cache.get(filename)).elements()) !== undefined

  const validateParsedNaclFileEquals = async (p1: ParsedNaclFile, p2: ParsedNaclFile): Promise<void> => {
    expect(await p1.elements()).toEqual(await p2.elements())
    expect(p1.filename).toEqual(p2.filename)
    expect(await p1.sourceMap?.()).toEqual(await p2.sourceMap?.())
    expect(await p1.data.errors()).toEqual(await p2.data.errors())
    expect(await p1.data.referenced()).toEqual(await p2.data.referenced())
  }

  beforeAll(async () => {
    jest.spyOn(Date, 'now').mockImplementation(() => someDateTimestamp)
    parsedInitDummy = await toParsedNaclFile(initDummyParsedKey, parseResultWithoutMD5InitDummy)
    parsedDummy = await toParsedNaclFile(dummyParsedKey, parseResultWithoutMD5)
    parsedDummy2 = await toParsedNaclFile(dummy2ParsedKey, parseResultWithoutMD5Dummy2)
    parsedToDelete = await toParsedNaclFile(toDeleteKey, toDeleteParseResult)
    parsedToDelete2 = await toParsedNaclFile(toDelete2Key, toDelete2ParseResult)
  })

  beforeEach(async () => {
    cache = createParseResultCache('mockCache', inMemoryRemoteMapsCreator, mockedStaticFilesSource, true)
  })

  describe('put', () => {
    let initCache: string | undefined
    beforeEach(async () => {
      await cache.put(dummyFilename, parsedDummy)
      initCache = await cache.getHash()
      await cache.put(dummy2Filename, parsedDummy2)
    })

    it('Should return the same value as inserted', async () => {
      await validateParsedNaclFileEquals(await cache.get(dummyFilename), parsedWithoutBuffer(parsedDummy))
    })

    it('should update the hash value', async () => {
      expect(await cache.getHash()).not.toEqual(initCache)
    })
  })

  describe('putAll', () => {
    let initCache: string | undefined
    beforeEach(async () => {
      await cache.put(initDummyFilename, parsedInitDummy)
      initCache = await cache.getHash()
      await cache.putAll({
        [dummyFilename]: parsedDummy,
        [dummy2Filename]: parsedDummy2,
      })
    })

    it('Should return the same value as inserted', async () => {
      await validateParsedNaclFileEquals(await cache.get(dummyFilename), parsedWithoutBuffer(parsedDummy))
      await validateParsedNaclFileEquals(await cache.get(dummy2Filename), parsedWithoutBuffer(parsedDummy2))
    })

    it('should update the hash value', async () => {
      expect(await cache.getHash()).not.toEqual(initCache)
    })
  })

  describe('hasValid', () => {
    beforeEach(async () => {
      await cache.put(dummyFilename, parsedDummy)
    })

    it('Should be true if content did not change', async () => {
      expect(await cache.hasValid(dummyParsedKey)).toBeTruthy()
    })

    it('Should be false if content changed', async () => {
      const newerDummyKey = {
        filename: dummyFilename,
        buffer: 'changed',
        lastModified: afterTimestamp,
      }
      expect(await cache.hasValid(newerDummyKey)).toBeFalsy()
    })

    it('Should be false if the filename does not exist', async () => {
      expect(await cache.hasValid({ filename: 'noSuchFile.nacl', buffer: 'some data' })).toBeFalsy()
    })
  })

  describe('get', () => {
    beforeEach(async () => {
      await cache.put(dummyFilename, parsedDummy)
    })
    it('Should get value if exists', async () => {
      expect(await fileExistsInCache(dummyFilename)).toEqual(true)
    })

    it('Should return undefined if file was not inserted', async () => {
      expect(await fileExistsInCache('lala/noexist.nacl')).toEqual(false)
    })
  })

  describe('delete', () => {
    let initCache: string | undefined
    beforeEach(async () => {
      await cache.put(toDeleteFilename, parsedToDelete)
      initCache = await cache.getHash()
      expect(await fileExistsInCache(toDeleteFilename)).toEqual(true)
      await cache.delete(toDeleteKey.filename)
    })
    it('Should delete by a specific key', async () => {
      await cache.delete(toDeleteKey.filename)
      expect(await fileExistsInCache(toDeleteFilename)).toEqual(false)
    })

    it('should update the hash value', async () => {
      expect(await cache.getHash()).not.toEqual(initCache)
    })
  })

  describe('deleteAll', () => {
    let initCache: string | undefined
    beforeEach(async () => {
      await cache.putAll({
        [toDeleteFilename]: parsedToDelete,
        [toDelete2Filename]: parsedToDelete2,
      })
      initCache = await cache.getHash()
      expect(await fileExistsInCache(toDeleteFilename)).toEqual(true)
      await cache.deleteAll([toDeleteKey.filename, toDelete2Key.filename])
    })
    it('Should delete by a specific key', async () => {
      expect(await fileExistsInCache(toDeleteFilename)).toEqual(false)
      expect(await fileExistsInCache(toDelete2Filename)).toEqual(false)
    })

    it('should update the hash value', async () => {
      expect(await cache.getHash()).not.toEqual(initCache)
    })
  })

  describe('list', () => {
    it('Should list all filenames', async () => {
      await cache.put(dummyFilename, parsedDummy)
      await cache.put(toDeleteFilename, parsedToDelete)
      const filesList = await cache.list()
      const currentFileNames = [dummyFilename, toDeleteFilename]
      expect(filesList.length).toEqual(currentFileNames.length)
      filesList.forEach(name => expect(currentFileNames.includes(name)).toBeTruthy())
    })
  })

  describe('clear', () => {
    it('Should not return value for any key after clear', async () => {
      await cache.put(dummyFilename, parsedDummy)
      await cache.put(toDeleteFilename, parsedToDelete)
      await cache.clear()
      expect(await fileExistsInCache(dummyFilename)).toEqual(false)
      expect(await fileExistsInCache(toDeleteFilename)).toEqual(false)
    })
  })

  describe('rename', () => {
    let clearFnsBeforeRename: jest.SpyInstance<Promise<void>>[]
    beforeEach(async () => {
      await cache.put(dummyFilename, parsedDummy)
      await cache.put(toDeleteFilename, parsedToDelete)
      await validateParsedNaclFileEquals(await cache.get(dummyFilename), parsedWithoutBuffer(parsedDummy))
      await validateParsedNaclFileEquals(await cache.get(toDeleteFilename), parsedWithoutBuffer(parsedToDelete))
      clearFnsBeforeRename = Object.values(remoteMaps).map(remoteMap => jest.spyOn(remoteMap, 'clear'))
      await cache.rename('newName')
    })

    it('Should return the same values before and after rename', async () => {
      await validateParsedNaclFileEquals(await cache.get(dummyFilename), parsedWithoutBuffer(parsedDummy))
      await validateParsedNaclFileEquals(await cache.get(toDeleteFilename), parsedWithoutBuffer(parsedToDelete))
    })

    // This is impl specific but we need to check we cleared the old remoteMaps
    it('Should clear all the remoteMaps created before the rename', async () => {
      clearFnsBeforeRename.forEach(clearFn => expect(clearFn).toHaveBeenCalled())
    })
  })

  describe('flush', () => {
    let remoteMapsFlushFuncs: jest.SpyInstance<Promise<boolean>>[]
    beforeEach(async () => {
      // Put stuff in the cache so there will be remoteMaps
      await cache.put(dummyFilename, parsedDummy)
      await cache.put(toDeleteFilename, parsedToDelete)
      remoteMapsFlushFuncs = Object.values(remoteMaps).map(remoteMap => jest.spyOn(remoteMap, 'flush'))
    })

    it('Should call flush on all created remoteMaps', async () => {
      await cache.flush()
      remoteMapsFlushFuncs.forEach(flushSpy => expect(flushSpy).toHaveBeenCalled())
    })

    it('Should also flush deleted files remoteMaps', async () => {
      await cache.delete(dummyParsedKey.filename)
      await cache.flush()
      remoteMapsFlushFuncs.forEach(flushSpy => {
        expect(flushSpy).toHaveBeenCalled()
      })
    })
  })

  describe('getAllErrors', () => {
    const errorA = {
      message: 'MessageA',
      severity: 'Warning' as SeverityLevel,
      summary: 'summary',
      subject: mockSourceRange,
      context: mockSourceRange,
    }
    const errorB = {
      message: 'MessageB',
      severity: 'Warning' as SeverityLevel,
      summary: 'summary',
      subject: mockSourceRange,
      context: mockSourceRange,
    }
    beforeEach(async () => {
      await cache.put(
        dummyFilename,
        await toParsedNaclFile(dummyParsedKey, {
          elements: [dummyObjectType],
          errors: [errorA],
          sourceMap,
        }),
      )
      await cache.put(
        toDeleteFilename,
        await toParsedNaclFile(toDeleteKey, {
          elements: [toDeleteObjectType],
          errors: [errorB],
          sourceMap,
        }),
      )
    })

    it('Should return all errors', async () => {
      const errors = await cache.getAllErrors()
      expect(errors.includes(errorA)).toBeTruthy()
      expect(errors.includes(errorB)).toBeTruthy()
    })

    it('Should unset errors when none exist', async () => {
      await cache.put(
        toDeleteFilename,
        await toParsedNaclFile(toDeleteKey, {
          elements: [toDeleteObjectType],
          errors: [],
          sourceMap,
        }),
      )
      const errors = await cache.getAllErrors()
      expect(errors.includes(errorA)).toBeTruthy()
      expect(errors.includes(errorB)).toBeFalsy()
    })
  })

  describe('non persistent workspace', () => {
    it('should not allow flush when the ws is non-persistent', async () => {
      const nonPCache = createParseResultCache('mockCache', inMemoryRemoteMapsCreator, mockedStaticFilesSource, false)
      await expect(() => nonPCache.flush()).rejects.toThrow()
    })
  })

  afterEach(async () => {
    remoteMaps = {}
  })
})
