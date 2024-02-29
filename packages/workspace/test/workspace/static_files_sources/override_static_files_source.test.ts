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
import { StaticFile } from '@salto-io/adapter-api'
import { hash } from '@salto-io/lowerdash'
import { MockInterface } from '@salto-io/test-utils'
import { StateStaticFilesSource } from '../../../src/workspace/static_files/common'
import { DirectoryStore } from '../../../src/workspace/dir_store'
import { buildOverrideStateStaticFilesSource } from '../../../src/workspace/state'

describe('buildOverrideStateStaticFilesSource', () => {
  let directoryStore: MockInterface<DirectoryStore<Buffer>>
  let staticFilesSource: StateStaticFilesSource
  beforeEach(async () => {
    directoryStore = {
      list: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      rename: jest.fn(),
      renameFile: jest.fn(),
      flush: jest.fn(),
      mtimestamp: jest.fn(),
      getFiles: jest.fn(),
      getTotalSize: jest.fn(),
      clone: jest.fn(),
      isEmpty: jest.fn(),
      getFullPath: jest.fn(),
      isPathIncluded: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
    }

    staticFilesSource = buildOverrideStateStaticFilesSource(directoryStore)
  })

  describe('get', () => {
    it('get should return a static file with content if md5 matches', async () => {
      directoryStore.get.mockResolvedValue({
        filename: 'path',
        buffer: Buffer.from('content'),
      })
      const file = (await staticFilesSource.getStaticFile({
        filepath: 'path',
        encoding: 'binary',
        hash: hash.toMD5('content'),
      })) as StaticFile
      expect(directoryStore.get).not.toHaveBeenCalled()

      expect(await file.getContent()).toEqual(Buffer.from('content'))
      expect(directoryStore.get).toHaveBeenCalledWith('path')

      expect(await file.getContent()).toEqual(Buffer.from('content'))
      expect(directoryStore.get).toHaveBeenCalledTimes(1)
    })

    it('get should return a static file without content if md5 does not match', async () => {
      directoryStore.get.mockResolvedValue({
        filename: 'path',
        buffer: Buffer.from('content'),
      })
      const file = (await staticFilesSource.getStaticFile({
        filepath: 'path',
        encoding: 'binary',
        hash: hash.toMD5('content2'),
      })) as StaticFile
      expect(directoryStore.get).not.toHaveBeenCalled()

      expect(await file.getContent()).toBeUndefined()
      expect(directoryStore.get).toHaveBeenCalledWith('path')
    })

    it('get should return a static file without content if not found in dir store', async () => {
      directoryStore.get.mockResolvedValue(undefined)
      const file = (await staticFilesSource.getStaticFile({
        filepath: 'path',
        encoding: 'binary',
        hash: hash.toMD5('content'),
      })) as StaticFile
      expect(directoryStore.get).not.toHaveBeenCalled()

      expect(await file.getContent()).toBeUndefined()
      expect(directoryStore.get).toHaveBeenCalledWith('path')

      expect(await file.getContent()).toBeUndefined()
      expect(directoryStore.get).toHaveBeenCalledTimes(1)
    })

    it('should throw when hash is not passed', async () => {
      directoryStore.get.mockResolvedValue(undefined)
      await expect(staticFilesSource.getStaticFile({ filepath: 'path', encoding: 'binary' })).rejects.toThrow()
    })
  })

  describe('set', () => {
    it('set should call the dir store set', async () => {
      await staticFilesSource.persistStaticFile(new StaticFile({ filepath: 'path', content: Buffer.from('content') }))
      expect(directoryStore.set).toHaveBeenCalledWith({ filename: 'path', buffer: Buffer.from('content') })
    })

    it('set should not call the dir store set if there is no content', async () => {
      await staticFilesSource.persistStaticFile(
        new StaticFile({ filepath: 'path', hash: hash.toMD5(Buffer.from('content')) }),
      )
      expect(directoryStore.set).not.toHaveBeenCalled()
    })
  })

  it('flush should call dir store flush', async () => {
    await staticFilesSource.flush()
    expect(directoryStore.flush).toHaveBeenCalled()
  })

  it('rename should call dir store rename', async () => {
    await staticFilesSource.rename('name')
    expect(directoryStore.rename).toHaveBeenCalledWith('name')
  })

  it('clear should call dir store clear', async () => {
    await staticFilesSource.clear()
    expect(directoryStore.clear).toHaveBeenCalled()
  })

  it('delete should call dir store delete', async () => {
    await staticFilesSource.delete(
      new StaticFile({
        filepath: 'name',
        content: Buffer.from('buf'),
      }),
    )
    expect(directoryStore.delete).toHaveBeenCalledWith('name')
  })
})
