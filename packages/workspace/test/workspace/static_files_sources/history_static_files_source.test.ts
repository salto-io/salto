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
import { buildHistoryStateStaticFilesSource } from '../../../src/workspace/state'

describe('buildHistoryStateStaticFilesSource', () => {
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

    staticFilesSource = buildHistoryStateStaticFilesSource(directoryStore)
  })

  describe('get', () => {
    it('get should return a static file', async () => {
      directoryStore.get.mockResolvedValue({
        filename: 'path',
        buffer: Buffer.from('content'),
      })
      const file = (await staticFilesSource.getStaticFile({
        filepath: 'path',
        encoding: 'binary',
        hash: hash.toMD5('content'),
      })) as StaticFile
      expect(file.filepath).toBe('path')
      expect(directoryStore.get).not.toHaveBeenCalled()

      expect(await file.getContent()).toEqual(Buffer.from('content'))
      expect(directoryStore.get).toHaveBeenCalledWith(`path-${hash.toMD5('content')}`)

      expect(await file.getContent()).toEqual(Buffer.from('content'))
      expect(directoryStore.get).toHaveBeenCalledTimes(1)
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
      expect(directoryStore.get).toHaveBeenCalledWith(`path-${hash.toMD5('content')}`)

      expect(await file.getContent()).toBeUndefined()
      expect(directoryStore.get).toHaveBeenCalledTimes(1)
    })

    it('should throw when hash is not passed', async () => {
      directoryStore.get.mockResolvedValue(undefined)
      await expect(staticFilesSource.getStaticFile({ filepath: 'path', encoding: 'binary' })).rejects.toThrow()
    })
  })

  describe('set', () => {
    it('set should call the dir store set if file does not exist in dir store', async () => {
      directoryStore.list.mockResolvedValue([])
      await staticFilesSource.persistStaticFile(new StaticFile({ filepath: 'path', content: Buffer.from('content') }))
      expect(directoryStore.list).toHaveBeenCalled()
      expect(directoryStore.set).toHaveBeenCalledWith({
        filename: `path-${hash.toMD5('content')}`,
        buffer: Buffer.from('content'),
      })
    })

    it('set should not call the dir store set if file exists in dir store', async () => {
      directoryStore.list.mockResolvedValue([`path-${hash.toMD5('content')}`])
      await staticFilesSource.persistStaticFile(new StaticFile({ filepath: 'path', content: Buffer.from('content') }))
      expect(directoryStore.list).toHaveBeenCalled()
      expect(directoryStore.set).not.toHaveBeenCalled()
    })

    it('set should not call the dir store set if there is no content', async () => {
      directoryStore.list.mockResolvedValue([])
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

  it('rename should do nothing', async () => {
    await staticFilesSource.rename('name')
    expect(directoryStore.rename).not.toHaveBeenCalled()
  })

  it('clear should do nothing', async () => {
    await staticFilesSource.clear()
    expect(directoryStore.clear).not.toHaveBeenCalled()
  })

  // * If delete is changed to do something, this may create a possible bug in 'getDanglingStaticFiles *
  it('delete should do nothing', async () => {
    await staticFilesSource.delete(
      new StaticFile({
        filepath: 'name',
        content: Buffer.from('buf'),
      }),
    )
    expect(directoryStore.delete).not.toHaveBeenCalled()
  })
})
