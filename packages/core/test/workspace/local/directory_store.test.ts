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
import * as path from 'path'
import readdirp from 'readdirp'
import { localDirectoryStore } from '../../../src/workspace/local/dir_store'
import * as file from '../../../src/file'

jest.mock('../../../src/file')
jest.mock('readdirp')
describe('localDirectoryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockState = file.stat as unknown as jest.Mock
  const mockFileExists = file.exists as jest.Mock
  const mockReadFile = file.readTextFile as unknown as jest.Mock
  const mockReaddirp = readdirp.promise as jest.Mock
  const mockReplaceContents = file.replaceContents as jest.Mock
  const mockMkdir = file.mkdirp as jest.Mock
  const mockRm = file.rm as jest.Mock
  const mockEmptyDir = file.emptyDir as jest.Mock
  const mockIsSubFolder = file.isSubFolder as jest.Mock

  describe('list', () => {
    it('returns empty list if dir not exists', async () => {
      mockFileExists.mockResolvedValue(false)
      const result = await localDirectoryStore('').list()
      expect(result).toEqual([])
    })
    it('skip hidden directories', async () => {
      const fileFilter = '*.bp'
      const dir = 'hidden'
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([{ fullPath: 'test1' }, { fullPath: 'test2' }])
      const result = await localDirectoryStore(dir, fileFilter).list()
      expect(result).toEqual(['test1', 'test2'])
      expect(mockReaddirp.mock.calls[0][0]).toEqual(dir)
      expect(mockReaddirp.mock.calls[0][1].fileFilter).toEqual(fileFilter)
      expect(mockReaddirp.mock.calls[0][1].directoryFilter({ basename: '.hidden' })).toBeFalsy()
    })
  })

  describe('get', () => {
    it('does not return the file if it does not exist', async () => {
      const dir = 'not-exists'
      const bpName = 'blabla/notexist.bp'
      mockFileExists.mockResolvedValue(false)
      const bp = await localDirectoryStore(dir).get(bpName)
      expect(bp).toBeUndefined()
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(dir, bpName))
      expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('returns the file if it exist', async () => {
      const dir = 'exists'
      const bpName = 'blabla/exist.bp'
      const content = 'content'
      mockFileExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue(content)
      mockState.mockResolvedValue({ mtimeMs: 7 })
      const bp = await localDirectoryStore(dir).get(bpName)
      expect(bp?.buffer).toBe(content)
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(dir, bpName))
      expect(mockReadFile.mock.calls[0][0]).toMatch(path.join(dir, bpName))
    })
  })

  describe('set', () => {
    const filename = 'inner/file'
    const buffer = 'bla'
    const bpStore = localDirectoryStore('')

    it('writes a content with the right filename', async () => {
      mockFileExists.mockResolvedValue(false)
      mockReplaceContents.mockResolvedValue(true)
      mockMkdir.mockResolvedValue(true)
      await bpStore.set({ filename, buffer })
      expect(mockMkdir).not.toHaveBeenCalled()
      expect(mockReplaceContents).not.toHaveBeenCalled()
      await bpStore.flush()
      expect(mockMkdir.mock.calls[0][0]).toMatch('inner')
      expect(mockReplaceContents.mock.calls[0][0]).toMatch(filename)
      expect(mockReplaceContents.mock.calls[0][1]).toEqual(buffer)
      mockReplaceContents.mockClear()
      await bpStore.flush()
      expect(mockReplaceContents).not.toHaveBeenCalled()
    })
  })

  describe('getFiles', () => {
    it('return multiple files', async () => {
      mockFileExists.mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
      mockReadFile.mockResolvedValueOnce('bla1').mockResolvedValueOnce('bla2')
      mockState.mockResolvedValue({ mtimeMs: 7 })
      const files = await localDirectoryStore('').getFiles(['', '', ''])
      expect(files[0]).toBeUndefined()
      expect(files[1]?.buffer).toEqual('bla1')
      expect(files[2]?.buffer).toEqual('bla2')
    })
  })

  describe('rm blueprint', () => {
    const baseDir = '/base'
    const multipleFilesDir = 'multi'
    const oneFileDir = 'single'
    const bpDir = path.join(baseDir, multipleFilesDir, oneFileDir)
    const bpName = 'rm_this.bp'
    const bpPath = path.join(bpDir, bpName)
    const bpStore = localDirectoryStore(baseDir)

    it('delete the blueprint', async () => {
      mockEmptyDir.mockResolvedValueOnce(false)
      await bpStore.delete(bpPath)
      await bpStore.flush()
      expect(mockRm).toHaveBeenCalledTimes(1)
      expect(mockRm).toHaveBeenCalledWith(bpPath)
    })

    it('delete an empty directory', async () => {
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      mockIsSubFolder.mockResolvedValueOnce(true).mockResolvedValueOnce(true)
      await bpStore.delete(bpPath)
      await bpStore.flush()
      expect(mockRm).toHaveBeenCalledTimes(2)
      expect(mockRm).toHaveBeenNthCalledWith(1, bpPath)
      expect(mockRm).toHaveBeenNthCalledWith(2, bpDir)
    })
  })
})
