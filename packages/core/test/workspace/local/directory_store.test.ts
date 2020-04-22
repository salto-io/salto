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
import {
  stat, exists, readTextFile, replaceContents, mkdirp, rm, isEmptyDir, isSubDirectory,
} from '@salto-io/file'
import { localDirectoryStore } from '../../../src/workspace/local/dir_store'

jest.mock('@salto-io/file', () => ({
  ...jest.requireActual('@salto-io/file'),
  readdirp: jest.fn(),
  stat: jest.fn(),
  exists: jest.fn(),
  readTextFile: jest.fn(),
  promise: jest.fn(),
  replaceContents: jest.fn(),
  mkdirp: jest.fn(),
  rm: jest.fn(),
  isEmptyDir: jest.fn(),
  isSubDirectory: jest.fn(),
}))
jest.mock('readdirp')
describe('localDirectoryStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockState = stat as unknown as jest.Mock
  const mockFileExists = exists as jest.Mock
  const mockReadFile = readTextFile as unknown as jest.Mock
  const mockReaddirp = readdirp.promise as jest.Mock
  const mockReplaceContents = replaceContents as jest.Mock
  const mockMkdir = mkdirp as jest.Mock
  const mockRm = rm as jest.Mock
  const mockEmptyDir = isEmptyDir as jest.Mock
  const mockIsSubFolder = isSubDirectory as jest.Mock

  describe('list', () => {
    it('returns empty list if dir not exists', async () => {
      mockFileExists.mockResolvedValue(false)
      const result = await localDirectoryStore('').list()
      expect(result).toEqual([])
    })
    it('skip hidden directories', async () => {
      const fileFilter = '*.nacl'
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
      const naclFileName = 'blabla/notexist.nacl'
      mockFileExists.mockResolvedValue(false)
      const naclFile = await localDirectoryStore(dir).get(naclFileName)
      expect(naclFile).toBeUndefined()
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(dir, naclFileName))
      expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('returns the file if it exist', async () => {
      const dir = 'exists'
      const naclFileName = 'blabla/exist.nacl'
      const content = 'content'
      mockFileExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue(content)
      mockState.mockResolvedValue({ mtimeMs: 7 })
      const naclFile = await localDirectoryStore(dir).get(naclFileName)
      expect(naclFile?.buffer).toBe(content)
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(dir, naclFileName))
      expect(mockReadFile.mock.calls[0][0]).toMatch(path.join(dir, naclFileName))
    })
  })

  describe('set', () => {
    const filename = 'inner/file'
    const buffer = 'bla'
    const naclFileStore = localDirectoryStore('')

    it('writes a content with the right filename', async () => {
      mockFileExists.mockResolvedValue(false)
      mockReplaceContents.mockResolvedValue(true)
      mockMkdir.mockResolvedValue(true)
      await naclFileStore.set({ filename, buffer })
      expect(mockMkdir).not.toHaveBeenCalled()
      expect(mockReplaceContents).not.toHaveBeenCalled()
      await naclFileStore.flush()
      expect(mockMkdir.mock.calls[0][0]).toMatch('inner')
      expect(mockReplaceContents.mock.calls[0][0]).toMatch(filename)
      expect(mockReplaceContents.mock.calls[0][1]).toEqual(buffer)
      mockReplaceContents.mockClear()
      await naclFileStore.flush()
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

  describe('rm Nacl file', () => {
    const baseDir = '/base'
    const multipleFilesDir = 'multi'
    const oneFileDir = 'single'
    const naclFileDir = path.join(baseDir, multipleFilesDir, oneFileDir)
    const naclFileName = 'rm_this.nacl'
    const naclFilePath = path.join(naclFileDir, naclFileName)
    const naclFileStore = localDirectoryStore(baseDir)

    it('delete the Nacl file', async () => {
      mockEmptyDir.mockResolvedValueOnce(false)
      await naclFileStore.delete(naclFilePath)
      await naclFileStore.flush()
      expect(mockRm).toHaveBeenCalledTimes(1)
      expect(mockRm).toHaveBeenCalledWith(naclFilePath)
    })

    it('delete an empty directory', async () => {
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      mockIsSubFolder.mockResolvedValueOnce(true).mockResolvedValueOnce(true)
      await naclFileStore.delete(naclFilePath)
      await naclFileStore.flush()
      expect(mockRm).toHaveBeenCalledTimes(2)
      expect(mockRm).toHaveBeenNthCalledWith(1, naclFilePath)
      expect(mockRm).toHaveBeenNthCalledWith(2, naclFileDir)
    })
  })
})
