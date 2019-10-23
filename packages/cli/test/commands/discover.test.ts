import {
  discover as mockDiscover,
  Workspace as mockWorksapce,
} from 'salto'
import { command } from '../../src/commands/discover'

jest.mock('salto', () => ({
  discover: jest.fn().mockImplementation(() => Promise.resolve()),
  Workspace: {
    load: jest.fn().mockImplementation(
      config => ({ config, hasErrors: () => false }),
    ),
  },
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
}))

describe('discover command', () => {
  const workspaceDir = 'dummy_dir'
  // const additaionFiles = ['dummy_filename.bp']
  describe('with a valid workspace', () => {
    beforeEach(async () => {
      await command(workspaceDir).execute()
    })
    it('should run discover with workspace loaded from provided directory', () => {
      const discoverCalls = (mockDiscover as jest.Mock).mock.calls
      expect(discoverCalls).toHaveLength(1)
      expect(discoverCalls[0][0].config.baseDir).toEqual(workspaceDir)
    })
  })
  describe('with errored workspace', () => {
    beforeEach(() => {
      mockWorksapce.load = jest.fn().mockImplementationOnce(
        baseDir => ({
          hasErrors: () => true,
          baseDir,
          errors: {
            strings: () => ['some error'],
          },
        })
      )
    })
    it('should fail', async () => {
      await expect(
        command(workspaceDir).execute()
      ).rejects.toThrow(/Failed to load/)
    })
  })
})
