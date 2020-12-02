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
  stat, exists, readFile, replaceContents, mkdirp, rm, isEmptyDir,
  rename, existsSync, readFileSync, statSync, notFoundAsUndefined,
} from '@salto-io/file'
import { localDirectoryStore } from '../../../src/local-workspace/dir_store'

jest.mock('@salto-io/file', () => ({
  ...jest.requireActual('@salto-io/file'),
  readdirp: jest.fn(),
  stat: jest.fn(),
  statSync: jest.fn(),
  exists: jest.fn(),
  existsSync: jest.fn(),
  readFile: jest.fn(),
  readFileSync: jest.fn(),
  promise: jest.fn(),
  replaceContents: jest.fn(),
  mkdirp: jest.fn(),
  rm: jest.fn(),
  rename: jest.fn(),
  isEmptyDir: jest.fn(),
}))
isEmptyDir.notFoundAsUndefined = notFoundAsUndefined(isEmptyDir)
rename.notFoundAsUndefined = notFoundAsUndefined(rename)
jest.mock('readdirp')
describe('localDirectoryStore', () => {
  const encoding = 'utf8'
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockStat = stat as unknown as jest.Mock
  const mockStatSync = statSync as unknown as jest.Mock
  const mockFileExists = exists as jest.Mock
  const mockFileSyncExists = existsSync as jest.Mock
  const mockReadFile = readFile as unknown as jest.Mock
  const mockReadFileSync = readFileSync as unknown as jest.Mock
  const mockReaddirp = readdirp.promise as jest.Mock
  const mockReplaceContents = replaceContents as jest.Mock
  const mockMkdir = mkdirp as jest.Mock
  const mockRm = rm as jest.Mock
  const mockRename = rename as unknown as jest.Mock
  const mockEmptyDir = isEmptyDir as unknown as jest.Mock

  describe('list', () => {
    it('returns empty list if dir not exists', async () => {
      mockFileExists.mockResolvedValue(false)
      const result = await localDirectoryStore({ baseDir: '', name: '', encoding }).list()
      expect(result).toEqual([])
    })
    it('skip hidden directories', async () => {
      const fileFilter = '*.nacl'
      const baseDir = 'hidden'
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([{ fullPath: 'test1' }, { fullPath: 'test2' }])
      const result = await localDirectoryStore({ baseDir, name: '', encoding, fileFilter }).list()
      expect(result).toEqual(['test1', 'test2'])
      expect(mockReaddirp.mock.calls[0][0]).toEqual(baseDir)
      expect(mockReaddirp.mock.calls[0][1].fileFilter).toEqual(fileFilter)
      expect(mockReaddirp.mock.calls[0][1].directoryFilter({ basename: '.hidden' })).toBeFalsy()
    })
  })

  describe('isEmpty', () => {
    it('returns true if dir does not exist', async () => {
      mockFileExists.mockResolvedValue(false)
      const result = await localDirectoryStore({ baseDir: 'not-found', name: '', encoding }).isEmpty()
      expect(result).toEqual(true)
    })
    it('return true if dir is empty', async () => {
      const fileFilter = '*.nacl'
      const baseDir = 'base'
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([])
      const result = await localDirectoryStore({ baseDir, name: '', encoding, fileFilter }).isEmpty()
      expect(result).toEqual(true)
    })
    it('return false if dir has files', async () => {
      const fileFilter = '*.nacl'
      const baseDir = 'base'
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([{ fullPath: 'test1' }, { fullPath: 'test2' }])
      const result = await localDirectoryStore({ baseDir, name: '', encoding, fileFilter }).isEmpty()
      expect(result).toEqual(false)
    })
  })

  describe('get', () => {
    it('does not return the file if it does not exist', async () => {
      const baseDir = 'not-exists'
      const naclFileName = 'blabla/notexist.nacl'
      mockFileExists.mockResolvedValue(false)
      const naclFile = await localDirectoryStore({ baseDir, name: '', encoding }).get(naclFileName)
      expect(naclFile).toBeUndefined()
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(baseDir, naclFileName))
      expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('returns the file if it exist for string dir store', async () => {
      const baseDir = 'exists'
      const naclFileName = 'blabla/exist.nacl'
      const content = 'content'
      mockFileExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue(content)
      mockStat.mockResolvedValue({ mtimeMs: 7 })
      const naclFile = await localDirectoryStore({ baseDir, name: '', encoding }).get(naclFileName)
      expect(naclFile?.buffer).toBe(content)
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(baseDir, naclFileName))
      expect(mockReadFile.mock.calls[0][0]).toMatch(path.join(baseDir, naclFileName))
      expect(mockReadFile.mock.calls[0][1]).toEqual({ encoding })
    })

    it('returns the file if it exist for Buffer dir store', async () => {
      const baseDir = '/base'
      const bufferStore = localDirectoryStore({ baseDir, name: '' })
      const bufferFileName = 'someBufferFile.ext'
      const content = Buffer.from('content')
      mockFileExists.mockReturnValue(true)
      mockReadFile.mockReturnValueOnce(content)
      mockStat.mockReturnValue({ mtimeMs: 7 })
      const bufferFile = await bufferStore.get(bufferFileName)
      expect(bufferFile?.buffer).toBe(content)
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(baseDir, bufferFileName))
      expect(mockReadFile.mock.calls[0][0]).toMatch(path.join(baseDir, bufferFileName))
      expect(mockReadFile.mock.calls[0][1]).toEqual({ encoding: undefined })
    })
  })

  describe('sync get', () => {
    it('does not return the file if it does not exist', () => {
      const baseDir = 'not-exists'
      const naclFileName = 'blabla/notexist.nacl'
      mockFileSyncExists.mockReturnValue(false)
      const naclFile = localDirectoryStore({ baseDir, name: '', encoding }).getSync(naclFileName)
      expect(naclFile).toBeUndefined()
      expect(mockFileSyncExists.mock.calls[0][0]).toMatch(path.join(baseDir, naclFileName))
      expect(mockReadFileSync).not.toHaveBeenCalled()
    })

    it('returns the file if it exist for string dir store', () => {
      const baseDir = 'exists'
      const naclFileName = 'blabla/exist.nacl'
      const content = 'content'
      mockFileSyncExists.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(content)
      mockStatSync.mockReturnValue({ mtimeMs: 7 })
      const naclFile = localDirectoryStore({ baseDir, name: '', encoding }).getSync(naclFileName)
      expect(naclFile?.buffer).toBe(content)
      expect(mockFileSyncExists.mock.calls[0][0]).toMatch(path.join(baseDir, naclFileName))
      expect(mockReadFileSync.mock.calls[0][0]).toMatch(path.join(baseDir, naclFileName))
      expect(mockReadFileSync.mock.calls[0][1]).toEqual({ encoding })
    })

    it('returns the file if it exist for Buffer dir store', () => {
      const baseDir = '/base'
      const bufferStore = localDirectoryStore({ baseDir, name: '' })
      const bufferFileName = 'someBufferFile.ext'
      const content = Buffer.from('content')
      mockFileSyncExists.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(content)
      mockStatSync.mockReturnValue({ mtimeMs: 7 })
      const bufferFile = bufferStore.getSync(bufferFileName)
      expect(bufferFile?.buffer).toBe(content)
      expect(mockFileSyncExists.mock.calls[0][0]).toMatch(path.join(baseDir, bufferFileName))
      expect(mockReadFileSync.mock.calls[0][0]).toMatch(path.join(baseDir, bufferFileName))
      expect(mockReadFileSync.mock.calls[0][1]).toEqual({ encoding: undefined })
    })
  })

  describe('set', () => {
    const filename = 'inner/file'

    it('writes a content with the right filename for string dir store', async () => {
      mockFileExists.mockResolvedValue(false)
      mockReplaceContents.mockResolvedValue(true)
      mockMkdir.mockResolvedValue(true)
      const buffer = 'bla'
      const naclFileStore = localDirectoryStore({ baseDir: '', name: '', encoding })
      await naclFileStore.set({ filename, buffer })
      expect(mockMkdir).not.toHaveBeenCalled()
      expect(mockReplaceContents).not.toHaveBeenCalled()
      await naclFileStore.flush()
      expect(mockMkdir.mock.calls[0][0]).toMatch('inner')
      expect(mockReplaceContents.mock.calls[0][0]).toMatch(filename)
      expect(mockReplaceContents.mock.calls[0][1]).toEqual(buffer)
      expect(mockReplaceContents.mock.calls[0][2]).toEqual(encoding)
      mockReplaceContents.mockClear()
      await naclFileStore.flush()
      expect(mockReplaceContents).not.toHaveBeenCalled()
    })

    it('writes a content with the right filename for Buffer dir store', async () => {
      mockFileExists.mockResolvedValue(false)
      mockReplaceContents.mockResolvedValue(true)
      mockMkdir.mockResolvedValue(true)
      const buffer = Buffer.from('bla')
      const bufferFileStore = localDirectoryStore({ baseDir: '', name: '' })
      await bufferFileStore.set({ filename, buffer })
      expect(mockMkdir).not.toHaveBeenCalled()
      expect(mockReplaceContents).not.toHaveBeenCalled()
      await bufferFileStore.flush()
      expect(mockMkdir.mock.calls[0][0]).toMatch('inner')
      expect(mockReplaceContents.mock.calls[0][0]).toMatch(filename)
      expect(mockReplaceContents.mock.calls[0][1]).toEqual(buffer)
      expect(mockReplaceContents.mock.calls[0][2]).toEqual(undefined)
      mockReplaceContents.mockClear()
      await bufferFileStore.flush()
      expect(mockReplaceContents).not.toHaveBeenCalled()
    })

    it('fails to get an absolute path', () =>
      localDirectoryStore({ baseDir: 'dir', name: '', encoding }).set({ filename: '/aaaa', buffer: 'aa' })
        .catch(err => expect(err.message).toEqual('Filepath not contained in dir store base dir: /aaaa')))
  })

  describe('getFiles', () => {
    it('return multiple files', async () => {
      mockFileExists.mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
      mockReadFile.mockResolvedValueOnce('bla1').mockResolvedValueOnce('bla2')
      mockStat.mockResolvedValue({ mtimeMs: 7 })
      const files = await localDirectoryStore({ baseDir: '', name: '', encoding }).getFiles(['', '', ''])
      expect(files[0]).toBeUndefined()
      expect(files[1]?.buffer).toEqual('bla1')
      expect(files[2]?.buffer).toEqual('bla2')
    })
    it('fails to get an absolute path', () =>
      localDirectoryStore({ baseDir: 'dir', name: '', encoding }).getFiles(['/aaaa'])
        .catch(err => expect(err.message).toEqual('Filepath not contained in dir store base dir: /aaaa')))
  })

  describe('rm Nacl file', () => {
    const baseDir = '/base'
    const multipleFilesDir = 'multi'
    const oneFileDir = 'single'
    const naclFileDir = path.join(baseDir, multipleFilesDir, oneFileDir)
    const naclFileName = 'rm_this.nacl'
    const naclFilePath = path.join(naclFileDir, naclFileName)
    const naclFileStore = localDirectoryStore({ baseDir, name: '', encoding })

    it('delete the Nacl file and its empty directory', async () => {
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      mockFileExists.mockResolvedValue(true)
      await naclFileStore.delete(naclFilePath)
      await naclFileStore.flush()
      expect(mockRm).toHaveBeenCalledTimes(2)
      expect(mockRm).toHaveBeenNthCalledWith(1, naclFilePath)
      expect(mockRm).toHaveBeenNthCalledWith(2, naclFileDir)
    })
    it('fails to delete an absolute path', async () =>
      naclFileStore.delete('/aaaa')
        .catch(err => expect(err.message).toEqual('Filepath not contained in dir store base dir: /aaaa')))
  })

  describe('clear', () => {
    const baseDir = '/base'
    const naclFileStore = localDirectoryStore({ baseDir, name: '', encoding })

    beforeAll(() => {
      mockReaddirp.mockResolvedValue([])
    })
    afterAll(() => {
      mockReaddirp.mockClear()
    })

    it('should delete the all the files', async () => {
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValueOnce([
        { fullPath: path.join(baseDir, 'test1') },
        { fullPath: path.join(baseDir, 'test2') },
      ]).mockResolvedValueOnce([])
      await naclFileStore.clear()
      expect(mockRm).toHaveBeenCalledTimes(3)
      expect(mockRm).toHaveBeenCalledWith(path.join(baseDir, 'test1'))
      expect(mockRm).toHaveBeenCalledWith(path.join(baseDir, 'test2'))
      expect(mockRm).toHaveBeenCalledWith(baseDir)
      expect(mockRm).not.toHaveBeenCalledWith(path.dirname(baseDir))
    })

    it('should delete empty directories', async () => {
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(true)
      mockReaddirp.mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { fullPath: path.join(baseDir, 'emptyDir') },
        ])
      await naclFileStore.clear()
      expect(mockRm).toHaveBeenCalledTimes(2)
      expect(mockRm).toHaveBeenCalledWith(path.join(baseDir, 'emptyDir'))
      expect(mockRm).toHaveBeenCalledWith(baseDir)
    })

    it('should not delete parent', async () => {
      const store = localDirectoryStore({ baseDir, name: 'name', encoding })
      const filePath = `${baseDir}/name`
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(
        true
      )
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValueOnce([
        { fullPath: path.join(filePath, 'test1') },
        { fullPath: path.join(filePath, 'test2') },
      ])
      await store.clear()
      expect(mockRm).toHaveBeenCalledTimes(3)
      expect(mockRm).toHaveBeenCalledWith(path.join(filePath, 'test1'))
      expect(mockRm).toHaveBeenCalledWith(path.join(filePath, 'test2'))
      expect(mockRm).toHaveBeenCalledWith(filePath)
      expect(mockRm).not.toHaveBeenCalledWith(baseDir)
    })
  })

  describe('rename', () => {
    const baseDir = '/dir'
    const name = 'base'
    const naclFileStore = localDirectoryStore({ baseDir, name, encoding })

    it('should rename the all files', async () => {
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([{ fullPath: path.join(baseDir, name, 'test1') }])
      await naclFileStore.rename('new')
      expect(mockRename).toHaveBeenCalledTimes(1)
      expect(mockRename).toHaveBeenCalledWith(path.join(baseDir, name, 'test1'), path.join(baseDir, 'new', 'test1'))
    })
  })

  describe('renameFile', () => {
    const baseDir = '/base'
    const naclFileStore = localDirectoryStore({ baseDir, name: '', encoding })

    it('should rename the file', async () => {
      await naclFileStore.renameFile('old', 'new')
      expect(mockRename).toHaveBeenCalledTimes(1)
      expect(mockRename).toHaveBeenCalledWith(path.join(baseDir, 'old'), path.join(baseDir, 'new'))
    })
  })

  describe('contained', () => {
    const baseDir = '/base'
    const fileStore = localDirectoryStore({ baseDir, name: '', encoding })
    it('should fail for absolute paths', () =>
      fileStore.get('/absolutely/fabulous')
        .catch(err =>
          expect(err.message).toEqual('Filepath not contained in dir store base dir: /absolutely/fabulous')))
    it('should fail for relative paths outside basedir', () =>
      fileStore.get('../../bla')
        .catch(err =>
          expect(err.message).toEqual('Filepath not contained in dir store base dir: ../../bla')))
    it('should fail for relative paths outside basedir even for smart assets', () =>
      fileStore.mtimestamp('something/bla/../../../dev/null')
        .catch(err =>
          expect(err.message).toEqual('Filepath not contained in dir store base dir: something/bla/../../../dev/null')))
    it('should succeed for paths that contain ".." as part of the parts names', () =>
      expect(fileStore.get('..relatively../..fabulous../..bla..jsonl')).resolves.not.toThrow())
  })

  describe('getTotalSize', () => {
    const baseDir = '/base'
    const naclFileStore = localDirectoryStore({ baseDir, name: '', encoding })

    it('should getTotalSize the file', async () => {
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValueOnce([
        { fullPath: path.join(baseDir, 'test1') },
        { fullPath: path.join(baseDir, 'test2') },
      ]).mockResolvedValueOnce([])
      mockStat
        .mockImplementation(filePath =>
          (filePath.endsWith('test1') ? ({ size: 5 }) : ({ size: 4 })))
      const totalSize = await naclFileStore.getTotalSize()
      expect(mockStat).toHaveBeenCalledTimes(2)
      expect(totalSize).toEqual(9)
    })
  })
  describe('getFullPath', () => {
    it('should return the full path of a file', () => {
      const baseDir = '/base'
      const name = 'name'
      const naclFileStore = localDirectoryStore({ baseDir, name, encoding })

      const filename = 'filename'
      expect(naclFileStore.getFullPath(filename)).toBe(`${baseDir}/${name}/${filename}`)
    })
  })
})
