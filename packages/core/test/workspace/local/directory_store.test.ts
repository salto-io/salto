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
import * as path from 'path'
import readdirp from 'readdirp'
import {
  stat,
  exists,
  readFile,
  replaceContents,
  mkdirp,
  rm,
  isEmptyDir,
  rename,
  notFoundAsUndefined,
} from '@salto-io/file'
import { dirStore as workspaceDirStore } from '@salto-io/workspace'
import { localDirectoryStore, createExtensionFileFilter } from '../../../src/local-workspace/dir_store'

jest.mock('@salto-io/file', () => ({
  ...jest.requireActual<{}>('@salto-io/file'),
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
  const mockFileExists = exists as jest.Mock
  const mockReadFile = readFile as unknown as jest.Mock
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
      const fileFilter = createExtensionFileFilter('nacl')
      const baseDir = 'hidden'
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([{ fullPath: 'test1' }, { fullPath: 'test2' }])
      const result = await localDirectoryStore({ baseDir, name: '', encoding, fileFilter }).list()
      expect(result).toEqual(['test1', 'test2'])
      expect(mockReaddirp.mock.calls[0][0]).toEqual(baseDir)
      expect(mockReaddirp.mock.calls[0][1].directoryFilter({ basename: '.hidden' })).toBeFalsy()
    })

    it('list only under accessible path', async () => {
      const baseDir = '/baseDir'
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([{ fullPath: '/baseDir/access/test1' }, { fullPath: '/baseDir/access/test2' }])
      const result = await localDirectoryStore({ baseDir, name: '', accessiblePath: 'access', encoding }).list()
      expect(result).toEqual(['access/test1', 'access/test2'])
      expect(mockReaddirp).toHaveBeenCalledTimes(1)
      expect(mockReaddirp).toHaveBeenCalledWith(path.join(baseDir, 'access'), expect.any(Object))
    })
  })

  describe('isEmpty', () => {
    it('returns true if dir does not exist', async () => {
      mockFileExists.mockResolvedValue(false)
      const result = await localDirectoryStore({ baseDir: 'not-found', name: '', encoding }).isEmpty()
      expect(result).toEqual(true)
    })
    it('return true if dir is empty', async () => {
      const fileFilter = createExtensionFileFilter('nacl')
      const baseDir = 'base'
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([])
      const result = await localDirectoryStore({ baseDir, name: '', encoding, fileFilter }).isEmpty()
      expect(result).toEqual(true)
    })
    it('return false if dir has files', async () => {
      const fileFilter = createExtensionFileFilter('nacl')
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

    it('does not return the file if it was deleted from the dir store', async () => {
      const baseDir = 'exists'
      const naclFileName = 'blabla/exist.nacl'
      const content = 'content'
      mockFileExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue(content)
      mockStat.mockResolvedValue({ mtimeMs: 7 })
      const dirStore = localDirectoryStore({ baseDir, name: '', encoding })
      await dirStore.delete(naclFileName)
      const naclFile = await dirStore.get(naclFileName)
      expect(naclFile).toBeUndefined()
      expect(mockFileExists).not.toHaveBeenCalled()
      expect(mockReadFile).not.toHaveBeenCalled()
    })

    it('does return deleted files if was requested to ignore cache', async () => {
      const baseDir = 'exists'
      const naclFileName = 'blabla/exist.nacl'
      const content = 'content'
      mockFileExists.mockResolvedValue(true)
      mockReadFile.mockResolvedValue(content)
      mockStat.mockResolvedValue({ mtimeMs: 7 })
      const dirStore = localDirectoryStore({ baseDir, name: '', encoding })
      await dirStore.delete(naclFileName)
      const naclFile = await dirStore.get(naclFileName, { ignoreDeletionsCache: true })
      expect(naclFile?.buffer).toBe(content)
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(baseDir, naclFileName))
      expect(mockReadFile.mock.calls[0][0]).toMatch(path.join(baseDir, naclFileName))
      expect(mockReadFile.mock.calls[0][1]).toEqual({ encoding })
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

  describe('mtimestamp', () => {
    it('does not return the timestamp if it the file was deleted from the dir store', async () => {
      const baseDir = 'exists'
      const naclFileName = 'blabla/exist.nacl'
      mockFileExists.mockResolvedValue(true)
      mockStat.mockResolvedValue({ mtimeMs: 7 })
      const dirStore = localDirectoryStore({ baseDir, name: '', encoding })
      await dirStore.delete(naclFileName)
      const timestamp = await dirStore.mtimestamp(naclFileName)
      expect(timestamp).toBeUndefined()
      expect(mockFileExists).not.toHaveBeenCalled()
      expect(mockStat).not.toHaveBeenCalled()
    })
  })

  describe('exists', () => {
    it('returns true if exists in the dir store', async () => {
      const baseDir = 'exists'
      const naclFileName = 'blabla/exist.nacl'
      mockFileExists.mockResolvedValue(true)
      expect(await localDirectoryStore({ baseDir, name: '', encoding }).exists(naclFileName)).toBeTruthy()
      expect(mockFileExists).toHaveBeenCalledWith(expect.stringContaining(path.join(baseDir, naclFileName)))
    })

    it('returns false if does not exist in the dir store', async () => {
      const baseDir = 'exists'
      const naclFileName = 'blabla/exist.nacl'
      mockFileExists.mockResolvedValue(false)
      expect(await localDirectoryStore({ baseDir, name: '', encoding }).exists(naclFileName)).toBeFalsy()
      expect(mockFileExists).toHaveBeenCalledWith(expect.stringContaining(path.join(baseDir, naclFileName)))
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
      localDirectoryStore({ baseDir: 'dir', name: '', encoding })
        .set({ filename: '/aaaa', buffer: 'aa' })
        .catch(err => expect(err.message).toEqual('Filepath not contained in dir store base dir: /aaaa')))
  })

  describe('getFiles', () => {
    it('return multiple files', async () => {
      mockFileExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(true)
      mockReadFile.mockResolvedValueOnce('bla1').mockResolvedValueOnce('bla2')
      mockStat.mockResolvedValue({ mtimeMs: 7 })
      const files = await localDirectoryStore({ baseDir: '', name: '', encoding }).getFiles(['', '', ''])
      expect(files[0]).toBeUndefined()
      expect(files[1]?.buffer).toEqual('bla1')
      expect(files[2]?.buffer).toEqual('bla2')
    })
    it('fails to get an absolute path', () =>
      localDirectoryStore({ baseDir: 'dir', name: '', encoding })
        .getFiles(['/aaaa'])
        .catch(err => expect(err.message).toEqual('Filepath not contained in dir store base dir: /aaaa')))

    it('Should return deleted file when requested to ignore cache', async () => {
      mockFileExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true).mockResolvedValueOnce(true)
      mockReadFile.mockResolvedValueOnce('bla1').mockResolvedValueOnce('bla2')
      mockStat.mockResolvedValue({ mtimeMs: 7 })
      const dirStore = localDirectoryStore({ baseDir: '', name: '', encoding })
      await dirStore.delete('b')
      const files = await dirStore.getFiles(['a', 'b', 'c'], { ignoreDeletionsCache: true })
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
      naclFileStore
        .delete('/aaaa')
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
      mockReaddirp
        .mockResolvedValueOnce([{ fullPath: path.join(baseDir, 'test1') }, { fullPath: path.join(baseDir, 'test2') }])
        .mockResolvedValueOnce([])
      await naclFileStore.clear()
      expect(mockRm).toHaveBeenCalledTimes(3)
      expect(mockRm).toHaveBeenCalledWith(path.join(baseDir, 'test1'))
      expect(mockRm).toHaveBeenCalledWith(path.join(baseDir, 'test2'))
      expect(mockRm).toHaveBeenCalledWith(baseDir)
      expect(mockRm).not.toHaveBeenCalledWith(path.dirname(baseDir))
    })

    it('should delete empty directories', async () => {
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(true)
      mockReaddirp.mockResolvedValueOnce([]).mockResolvedValueOnce([{ fullPath: path.join(baseDir, 'emptyDir') }])
      await naclFileStore.clear()
      expect(mockRm).toHaveBeenCalledTimes(2)
      expect(mockRm).toHaveBeenCalledWith(path.join(baseDir, 'emptyDir'))
      expect(mockRm).toHaveBeenCalledWith(baseDir)
    })

    it('should not delete parent', async () => {
      const store = localDirectoryStore({ baseDir, name: 'name', encoding })
      const filePath = `${baseDir}/name`
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true)
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
    const fileStore = localDirectoryStore({ baseDir, name: '', accessiblePath: 'access', encoding })
    it('should fail for absolute paths', () =>
      fileStore
        .get('/absolutely/fabulous')
        .catch(err =>
          expect(err.message).toEqual('Filepath not contained in dir store base dir: /absolutely/fabulous'),
        ))
    it('should fail for relative paths outside basedir', () =>
      fileStore
        .get('../../bla')
        .catch(err => expect(err.message).toEqual('Filepath not contained in dir store base dir: ../../bla')))

    it('should fail for relative paths inside basedir but outside accessible path', () =>
      fileStore
        .get('bla')
        .catch(err => expect(err.message).toEqual('Filepath not contained in dir store base dir: bla')))

    it('should fail for relative paths outside basedir even for smart assets', () =>
      fileStore
        .mtimestamp('something/bla/../../../dev/null')
        .catch(err =>
          expect(err.message).toEqual('Filepath not contained in dir store base dir: something/bla/../../../dev/null'),
        ))
    it('should succeed for paths that contain ".." as part of the parts names', () =>
      expect(fileStore.get('access/..relatively../..fabulous../..bla..jsonl')).resolves.not.toThrow())
  })

  describe('getTotalSize', () => {
    const baseDir = '/base'
    const naclFileStore = localDirectoryStore({ baseDir, name: '', encoding })

    it('should getTotalSize the file', async () => {
      mockEmptyDir.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
      mockFileExists.mockResolvedValue(true)
      mockReaddirp
        .mockResolvedValueOnce([{ fullPath: path.join(baseDir, 'test1') }, { fullPath: path.join(baseDir, 'test2') }])
        .mockResolvedValueOnce([])
      mockStat.mockImplementation(filePath => (filePath.endsWith('test1') ? { size: 5 } : { size: 4 }))
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

  describe('isPathIncluded', () => {
    const baseDir = '/base'
    const fileFilter = (filePath: string): boolean => path.extname(filePath) === '.nacl'
    const directoryFilter = (filePath: string): boolean => !path.dirname(filePath).includes('exclude')
    const naclFileStore = localDirectoryStore({ baseDir, encoding, fileFilter, directoryFilter })

    it('should return true for file which are in the path and passes both the directory and file filters', () => {
      expect(naclFileStore.isPathIncluded(path.resolve(baseDir, 'sup.nacl'))).toBeTruthy()
    })
    it('should return false for file which are in the path and do not path the files filter', () => {
      expect(naclFileStore.isPathIncluded(path.resolve(baseDir, 'sup.exe'))).toBeFalsy()
    })
    it('should return false for file which are in the path and do not path the directory filter', () => {
      expect(naclFileStore.isPathIncluded(path.resolve(baseDir, 'exclude', 'sup.nacl'))).toBeFalsy()
    })
    it('should return false for files which are not in the path', () => {
      expect(naclFileStore.isPathIncluded(path.resolve('/nope', 'sup.nacl'))).toBeFalsy()
    })
  })

  describe('flush', () => {
    let dirStore: workspaceDirStore.DirectoryStore<workspaceDirStore.ContentType>
    const buffer = Buffer.from('bla')
    const removedFlat = 'a'
    const createdNested = 'a/a'
    const removedNested = 'b/b'
    const createdFlat = 'b'

    beforeEach(async () => {
      dirStore = localDirectoryStore({ baseDir: '', name: '' })
      await dirStore.set({ filename: removedFlat, buffer })
      await dirStore.set({ filename: removedNested, buffer })
      await dirStore.flush()

      jest.clearAllMocks()
    })

    it('can remove a file and create another file nested under an identically-named folder, and vice-versa', async () => {
      const callOrder: string[] = []
      mockRm.mockResolvedValue(true)
      mockMkdir.mockResolvedValue(true)
      mockReplaceContents.mockImplementation(() => {
        callOrder.push('replace')
      })
      mockRm.mockImplementation(() => {
        callOrder.push('rm')
      })
      await dirStore.set({ filename: createdNested, buffer })
      await dirStore.set({ filename: createdFlat, buffer })
      await dirStore.delete(removedFlat)
      await dirStore.delete(removedNested)
      expect(mockMkdir).not.toHaveBeenCalled()
      expect(mockReplaceContents).not.toHaveBeenCalled()
      expect(mockRm).not.toHaveBeenCalled()
      await dirStore.flush()
      expect(callOrder).toEqual(['rm', 'rm', 'rm', 'replace', 'replace'])
      expect(mockRm.mock.calls[0][0]).toMatch(removedFlat)
      expect(mockRm.mock.calls[1][0]).toMatch(removedNested)
      expect(mockReplaceContents.mock.calls[0][0]).toMatch(createdNested)
      expect(mockReplaceContents.mock.calls[1][0]).toMatch(createdFlat)
    })
  })
})
