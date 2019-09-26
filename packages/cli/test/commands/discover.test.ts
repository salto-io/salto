import { discover as mockDiscover, Workspace as mockWorksapce } from 'salto'
import { command } from '../../src/commands/discover'

jest.mock('salto', () => ({
  discover: jest.fn().mockImplementation((_workspace, _fillConfig) => Promise.resolve()),
  Workspace: {
    load: jest.fn().mockImplementation(
      baseDir => ({ baseDir, errors: [] }),
    ),
  },
}))

describe('discover command', () => {
  const workspaceDir = 'dummy_dir'
  const additaionFiles = ['dummy_filename.bp']
  describe('with a valid workspace', () => {
    beforeEach(async () => {
      await command(workspaceDir, additaionFiles).execute()
    })
    it('should run discover with workspace loaded from provided directory', () => {
      const discoverCalls = (mockDiscover as jest.Mock).mock.calls
      expect(discoverCalls).toHaveLength(1)
      expect(discoverCalls[0][0].baseDir).toEqual(workspaceDir)
    })
  })
  describe('with errored workspace', () => {
    beforeEach(() => {
      mockWorksapce.load = jest.fn().mockImplementationOnce(
        baseDir => ({ baseDir, errors: ['failed to load'] }),
      )
    })
    it('should fail', async () => {
      await expect(
        command(workspaceDir, additaionFiles).execute()
      ).rejects.toThrow(/failed to load/)
    })
  })
})
