import * as path from 'path'
import readdirp from 'readdirp'
import { localBlueprintsStore } from '../../../src/workspace/local/blueprints_store'
import * as file from '../../../src/file'

jest.mock('../../../src/file')
jest.mock('readdirp')
describe('localBlueprintsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const mockState = file.stat as unknown as jest.Mock
  const mockFileExists = file.exists as jest.Mock
  const mockReadFile = file.readTextFile as unknown as jest.Mock
  const mockReaddirp = readdirp.promise as jest.Mock
  const mockReplaceContents = file.replaceContents as jest.Mock
  const mockMkdir = file.mkdirp as jest.Mock
  describe('list', () => {
    it('returns empty list if dir not exists', async () => {
      mockFileExists.mockResolvedValue(false)
      const result = await localBlueprintsStore('').list()
      expect(result).toEqual([])
    })
    it('skip hidden directories', async () => {
      const dir = 'hidden'
      mockFileExists.mockResolvedValue(true)
      mockReaddirp.mockResolvedValue([{ fullPath: 'test1' }, { fullPath: 'test2' }])
      const result = await localBlueprintsStore(dir).list()
      expect(result).toEqual(['test1', 'test2'])
      expect(mockReaddirp.mock.calls[0][0]).toEqual(dir)
      expect(mockReaddirp.mock.calls[0][1].fileFilter).toEqual('*.bp')
      expect(mockReaddirp.mock.calls[0][1].directoryFilter({ basename: '.hidden' })).toBeFalsy()
    })
  })

  describe('get', () => {
    it('does not return the file if it does not exist', async () => {
      const dir = 'not-exists'
      const bpName = 'blabla/notexist.bp'
      mockFileExists.mockResolvedValue(false)
      const bp = await localBlueprintsStore(dir).get(bpName)
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
      const bp = await localBlueprintsStore(dir).get(bpName)
      expect(bp?.buffer).toBe(content)
      expect(mockFileExists.mock.calls[0][0]).toMatch(path.join(dir, bpName))
      expect(mockReadFile.mock.calls[0][0]).toMatch(path.join(dir, bpName))
    })
  })

  describe('set', () => {
    it('writes a content with the right filename', async () => {
      const filename = 'inner/file'
      const buffer = 'bla'
      mockFileExists.mockResolvedValue(false)
      mockReplaceContents.mockResolvedValue(true)
      mockMkdir.mockResolvedValue(true)
      await localBlueprintsStore('').set({ filename, buffer })
      expect(mockMkdir.mock.calls[0][0]).toMatch('inner')
      expect(mockReplaceContents.mock.calls[0][0]).toMatch(filename)
      expect(mockReplaceContents.mock.calls[0][1]).toEqual(buffer)
    })
  })
})
