/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { StaticFile } from '@salto-io/adapter-api'
import _ from 'lodash'
import { mockStaticFilesCache } from '../../common/static_files_cache'
import { DirectoryStore } from '../../../src/workspace/dir_store'
import { buildStaticFilesSource, StaticFilesCache, LazyStaticFile, buildInMemStaticFilesSource } from '../../../src/workspace/static_files'

import {
  InvalidStaticFile, StaticFilesSource, MissingStaticFile, AccessDeniedStaticFile,
} from '../../../src/workspace/static_files/common'


import {
  hashedContent, exampleStaticFileWithHash,
  exampleStaticFileWithContent, defaultBuffer, defaultFile,
} from '../../utils'

describe('Static Files', () => {
  describe('Static Files Source', () => {
    let staticFilesSource: Required<StaticFilesSource>
    let mockDirStore: DirectoryStore<Buffer>
    let mockCacheStore: StaticFilesCache
    beforeEach(() => {
      mockCacheStore = mockStaticFilesCache()
      mockDirStore = {
        list: () => Promise.resolve([]),
        isEmpty: () => Promise.resolve(false),
        get: jest.fn().mockResolvedValue(undefined),
        getFiles: jest.fn().mockResolvedValue([undefined]),
        set: () => Promise.resolve(),
        delete: jest.fn().mockResolvedValue(undefined),
        clear: () => Promise.resolve(),
        rename: () => Promise.resolve(),
        renameFile: () => Promise.resolve(),
        flush: () => Promise.resolve(),
        mtimestamp: jest.fn().mockImplementation(() => Promise.resolve(undefined)),
        getTotalSize: () => Promise.resolve(0),
        clone: () => mockDirStore,
        getFullPath: filename => filename,
        isPathIncluded: jest.fn().mockResolvedValue(true),
        exists: jest.fn().mockResolvedValue(true),
      }
      staticFilesSource = buildStaticFilesSource(
        mockDirStore,
        mockCacheStore,
      )
    })
    describe('Get By Value', () => {
      describe('file finding logic', () => {
        it('not find when no matching', async () => {
          const result = await staticFilesSource.getStaticFile('aa', 'binary')
          expect(result).toBeInstanceOf(InvalidStaticFile)
          expect(result).toBeInstanceOf(MissingStaticFile)
        })

        it('return without content when hash requested and not matching', async () => {
          const result = await staticFilesSource.getStaticFile('aa', 'binary', 'hash')
          expect(result).toBeInstanceOf(StaticFile)
          return expect(await (result as StaticFile).getContent()).toBeUndefined()
        })
        it('blow up if invalid file', async () => {
          mockDirStore.mtimestamp = jest.fn().mockRejectedValue('whatevz')
          const result = await staticFilesSource.getStaticFile('/aa', 'binary')
          expect(result).toBeInstanceOf(InvalidStaticFile)
          expect(result).toBeInstanceOf(AccessDeniedStaticFile)
        })
        it('find when matching', async () => {
          const filepathFromCache = 'filepathfromcache'
          mockDirStore.get = jest.fn().mockResolvedValue(defaultFile)
          mockDirStore.mtimestamp = jest.fn(
            (filepath: string): Promise<number | undefined> =>
              Promise.resolve(
                filepath.endsWith(filepathFromCache)
                  ? 1000
                  : undefined
              )
          )
          mockCacheStore.get = jest.fn().mockResolvedValue({
            filepath: filepathFromCache,
            modified: 100,
            hash: 'aaa',
          })
          const result = await staticFilesSource.getStaticFile(filepathFromCache, 'binary')

          expect(mockDirStore.mtimestamp).toHaveBeenCalledWith(filepathFromCache)
          expect(result).toHaveProperty('hash', hashedContent)
          expect(result).toBeInstanceOf(StaticFile)
          expect(await (result as StaticFile).getContent()).toBe(defaultBuffer)
        })

        it('return without content when matching with wrong hash', async () => {
          const filepathFromCache = 'filepathfromcache'
          mockDirStore.get = jest.fn().mockResolvedValue(defaultFile)
          mockDirStore.mtimestamp = jest.fn(
            (filepath: string): Promise<number | undefined> =>
              Promise.resolve(
                filepath.endsWith(filepathFromCache)
                  ? 1000
                  : undefined
              )
          )
          mockCacheStore.get = jest.fn().mockResolvedValue({
            filepath: filepathFromCache,
            modified: 100,
            hash: 'aaa',
          })
          const result = await staticFilesSource.getStaticFile(filepathFromCache, 'binary', 'bbb')

          expect(result).toBeInstanceOf(StaticFile)
          expect(await (result as StaticFile).getContent()).toBeUndefined()
        })
      })
      describe('hashing', () => {
        it('should not hash if in cache and file not modified', async () => {
          const filepathFromCache = 'filepathfromcache'
          mockDirStore.get = jest.fn().mockResolvedValue(defaultFile)
          mockDirStore.mtimestamp = jest.fn(
            (filepath: string): Promise<number | undefined> =>
              Promise.resolve(
                filepath.endsWith('bb')
                  ? 100
                  : undefined
              )
          )
          mockCacheStore.get = jest.fn().mockResolvedValue({
            filepath: filepathFromCache,
            modified: 1000,
            hash: 'aaa',
          })
          const result = await staticFilesSource.getStaticFile('bb', 'binary')
          expect(mockDirStore.get).toHaveBeenCalledTimes(0)
          expect(result).toHaveProperty('hash', 'aaa')
          expect(mockDirStore.get).not.toHaveBeenCalled()
          const staticFileRes = result as StaticFile
          expect(await staticFileRes.getContent()).toEqual(defaultBuffer)
          expect(mockDirStore.get).toHaveBeenCalled()
        })
        it('should hash if in cache and file modified is newer', async () => {
          const filepathFromCache = 'filepathfromcache'
          mockDirStore.get = jest.fn().mockResolvedValue(defaultFile)
          mockDirStore.mtimestamp = jest.fn(
            (filepath: string): Promise<number | undefined> =>
              Promise.resolve(
                filepath.endsWith('bb')
                  ? 1000
                  : undefined
              )
          )
          mockCacheStore.get = jest.fn().mockResolvedValue({
            filepath: filepathFromCache,
            modified: 100,
            hash: 'aaa',
          })
          const result = await staticFilesSource.getStaticFile('bb', 'binary')
          expect(mockDirStore.get).toHaveBeenCalledTimes(1)
          return expect(result).toHaveProperty('hash', hashedContent)
        })
        it('should hash if not cache', async () => {
          mockDirStore.get = jest.fn().mockResolvedValue(defaultFile)
          mockDirStore.mtimestamp = jest.fn(
            (filepath: string): Promise<number | undefined> =>
              Promise.resolve(
                filepath.endsWith('bb')
                  ? 1000
                  : undefined
              )
          )
          mockCacheStore.get = jest.fn().mockResolvedValue(undefined)
          const result = await staticFilesSource.getStaticFile('bb', 'binary')
          expect(mockDirStore.get).toHaveBeenCalledTimes(1)
          return expect(result).toHaveProperty('hash', hashedContent)
        })
        it('should return undefined if not able to read file for hash', async () => {
          mockDirStore.get = jest.fn().mockResolvedValue(undefined)
          mockDirStore.mtimestamp = jest.fn()
            .mockResolvedValue(Promise.resolve(42))
          mockCacheStore.get = jest.fn().mockResolvedValue(undefined)

          const result = await staticFilesSource.getStaticFile('bb', 'binary')
          return expect(result).toBeInstanceOf(InvalidStaticFile)
        })
      })
    })
    describe('Get Static File For Adapter', () => {
      it('should find buffer if in dir store', async () => {
        mockDirStore.get = jest.fn().mockResolvedValue(defaultFile)
        return expect(staticFilesSource.getContent(exampleStaticFileWithHash.filepath))
          .resolves.toEqual(defaultBuffer)
      })
      it('should fail if not found in dirstore', () =>
        staticFilesSource.getContent(exampleStaticFileWithHash.filepath)
          .catch(e => expect(e.message).toEqual('Missing content on static file: path')))
    })
    describe('Flush', () => {
      it('should flush all directory stores', async () => {
        mockDirStore.flush = jest.fn().mockResolvedValue(Promise.resolve())
        mockCacheStore.flush = jest.fn().mockResolvedValue(Promise.resolve())
        await staticFilesSource.flush()
        expect(mockCacheStore.flush).toHaveBeenCalledTimes(1)
        expect(mockDirStore.flush).toHaveBeenCalledTimes(1)
      })
    })
    describe('Clear', () => {
      it('should clear all directory stores', async () => {
        mockDirStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
        mockCacheStore.clear = jest.fn().mockResolvedValue(Promise.resolve())
        await staticFilesSource.clear()
        expect(mockCacheStore.clear).toHaveBeenCalledTimes(1)
        expect(mockDirStore.clear).toHaveBeenCalledTimes(1)
      })
    })
    describe('Rename', () => {
      it('should rename all directory stores', async () => {
        const newName = 'new'
        mockDirStore.rename = jest.fn().mockResolvedValue(Promise.resolve())
        mockCacheStore.rename = jest.fn().mockResolvedValue(Promise.resolve())
        await staticFilesSource.rename(newName)
        expect(mockCacheStore.rename).toHaveBeenCalledTimes(1)
        expect(mockCacheStore.rename).toHaveBeenCalledWith(newName)
        expect(mockDirStore.rename).toHaveBeenCalledTimes(1)
        expect(mockDirStore.rename).toHaveBeenCalledWith(newName)
      })
    })
    describe('Clone', () => {
      it('should still get the same value', async () => {
        mockCacheStore.get = jest.fn().mockResolvedValue({
          filepath: 'bbb',
          modified: 100,
          hash: 'aaa',
        })
        mockDirStore.get = jest.fn().mockResolvedValue(defaultFile)

        await expect(staticFilesSource.getContent(exampleStaticFileWithHash.filepath))
          .resolves.toEqual(defaultBuffer)

        const clonedStaticFilesSource = staticFilesSource.clone()

        return expect(clonedStaticFilesSource.getContent(exampleStaticFileWithHash.filepath))
          .resolves.toEqual(defaultBuffer)
      })
    })
    describe('Persist Static Files', () => {
      beforeEach(() => {
        mockDirStore.set = jest.fn().mockResolvedValue(Promise.resolve())
      })
      it('should fail if trying to persist for a static file metadata without content', () =>
        staticFilesSource.persistStaticFile(exampleStaticFileWithHash)
          .catch(e => expect(e.message).toEqual('Missing content on static file: path')))

      it('should fail if trying to persist for a static file without content', () =>
        staticFilesSource.persistStaticFile(exampleStaticFileWithHash)
          .catch(e => expect(e.message).toEqual('Missing content on static file: path')))
      it('should persist valid static file with content', async () => {
        await staticFilesSource.persistStaticFile(exampleStaticFileWithContent)
        expect(mockDirStore.set).toHaveBeenCalledTimes(1)
      })
    })
    describe('delete a file', () => {
      it('should invoke the dir store delete method with the static file file path attribute', async () => {
        await staticFilesSource.delete(exampleStaticFileWithContent)
        expect(mockDirStore.delete).toHaveBeenCalledWith(exampleStaticFileWithContent.filepath)
      })
    })
    describe('load', () => {
      let changedFiles: string[]
      const newFile = {
        filename: 'new.txt',
        modified: 12345,
        hash: '9cd599a3523898e6a12e13ec787da50a',
        buffer: 'new',
      }
      const modifiedFileBefore = {
        filename: 'modified.txt',
        modified: 12345,
        hash: 'ab8d71b3fdce92efd8bdf29cffd36116',
        buffer: 'before',
      }
      const modifiedFileAfter = {
        filename: 'modified.txt',
        modified: 12346,
        hash: '99fd6b62bc270c9bc820dc111f370acd',
        buffer: 'after',
      }
      const regFile = {
        filename: 'reg.txt',
        modified: 12345,
        hash: '4200f0916f146d2ac5448e91a3afe1b3',
        buffer: 'reg',
      }
      const deletedFile = {
        filename: 'deleted.txt',
        modified: 12345,
        hash: '12e7bce94552f7a4288921f908df9b8c',
        buffer: 'del',
      }
      const dirStoreFiles = _.keyBy([newFile, modifiedFileAfter, regFile], 'filename')
      const cacheFiles = _.keyBy([deletedFile, modifiedFileBefore, regFile], 'filename')
      beforeEach(async () => {
        mockDirStore.list = jest.fn().mockResolvedValueOnce(Object.keys(dirStoreFiles))
        mockCacheStore.list = jest.fn().mockResolvedValueOnce(Object.keys(cacheFiles))
        mockDirStore.get = jest.fn().mockImplementation(async name => dirStoreFiles[name])
        mockDirStore.mtimestamp = jest.fn()
          .mockImplementation(async name => dirStoreFiles[name].modified)
        mockCacheStore.get = jest.fn().mockImplementation(async name => cacheFiles[name])
        changedFiles = await staticFilesSource.load()
      })
      it('should detect addition of new files', () => {
        expect(changedFiles).toContain(newFile.filename)
      })
      it('should detect deletions of existing files', () => {
        expect(changedFiles).toContain(deletedFile.filename)
      })
      it('should detect changes in modified files', () => {
        expect(changedFiles).toContain(modifiedFileAfter.filename)
      })
      it('should not return files that were not changed', () => {
        expect(changedFiles).not.toContain(regFile.filename)
      })
    })
  })
  describe('Lazy Static File', () => {
    describe('getContent', () => {
      it('should not call directory store get method twice', async () => {
        const buffer = 'test'
        const mockDirStoreGet = jest.fn().mockResolvedValue(buffer)
        const lazyStaticFile = new LazyStaticFile('test', 'abcdefgh', 'test', mockDirStoreGet)
        // Twice on purpose
        expect(await lazyStaticFile.getContent()).toEqual(buffer)
        expect(await lazyStaticFile.getContent()).toEqual(buffer)
        expect(mockDirStoreGet).toHaveBeenCalledTimes(1)
      })
    })
  })
  describe('buildInMemStaticFilesSource', () => {
    describe('with no initial files', () => {
      let source: StaticFilesSource
      beforeEach(() => {
        source = buildInMemStaticFilesSource()
      })
      it('should allow persisting and reading back a file', async () => {
        const file = new StaticFile({ filepath: 'asd', hash: 'aaa' })
        await source.persistStaticFile(file)
        expect(await source.getStaticFile(file.filepath, file.encoding)).toEqual(file)
      })
      it('should return missing file for files that are not in the map', async () => {
        expect(await source.getStaticFile('asd', 'utf-8')).toBeInstanceOf(MissingStaticFile)
      })
      it('should get file content if there is a content', async () => {
        const file = new StaticFile({ filepath: 'asd', content: Buffer.from('bla') })
        await source.persistStaticFile(file)
        await expect(source.getContent(file.filepath)).resolves.toEqual(await file.getContent())
      })
      it('should throw if file has no content', async () => {
        const file = new StaticFile({ filepath: 'asd', hash: 'a' })
        await source.persistStaticFile(file)
        await expect(() => source.getContent(file.filepath)).rejects.toThrow()
        await expect(() => source.getContent('non-existing-path')).rejects.toThrow()
      })
      it('rename and flush should do nothing', async () => {
        await expect(source.flush()).resolves.not.toThrow()
        await expect(source.rename('new_name')).resolves.not.toThrow()
      })
      it('getTotalSize should return 0', async () => {
        expect(await source.getTotalSize()).toEqual(0)
      })
      it('isPathIncluded should return true for all paths', async () => {
        expect(source.isPathIncluded('any_path')).toBeTruthy()
      })
    })
    describe('with initial files map', () => {
      let file: StaticFile
      let source: StaticFilesSource
      beforeEach(() => {
        file = new StaticFile({ filepath: 'asd', hash: 'a' })
        source = buildInMemStaticFilesSource(new Map([[file.filepath, file]]))
      })
      it('should not return a file after it is deleted', async () => {
        await source.delete(file)
        expect(
          await source.getStaticFile(file.filepath, file.encoding)
        ).toBeInstanceOf(MissingStaticFile)
      })
      it('should not return a file after it is cleared', async () => {
        await source.clear()
        expect(
          await source.getStaticFile(file.filepath, file.encoding)
        ).toBeInstanceOf(MissingStaticFile)
      })
      it('should clone to a new source with the same files', async () => {
        const cloned = source.clone()
        // Make sure the cloned source is decoupled by deleting the file in the original source
        // and checking it is not deleted from the clone
        await source.delete(file)
        expect(await cloned.getStaticFile(file.filepath, file.encoding)).toEqual(file)
      })
    })
  })
})
