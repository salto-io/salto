import {
  api, workspace as ws,
} from 'salto'
import { command } from '../../src/commands/discover'

jest.mock('salto', () => ({
  api: {
    discover: jest.fn().mockImplementation(() => Promise.resolve()),
  },
  workspace: {
    Workspace: {
      load: jest.fn().mockImplementation(
        baseDir => ({ baseDir, hasErrors: () => false }),
      ),
    },
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
      const discoverCalls = (api.discover as jest.Mock).mock.calls
      expect(discoverCalls).toHaveLength(1)
      expect(discoverCalls[0][0].baseDir).toEqual(workspaceDir)
    })
  })
  describe('with errored workspace', () => {
    beforeEach(() => {
      ws.Workspace.load = jest.fn().mockImplementationOnce(
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
        command(workspaceDir, additaionFiles).execute()
      ).rejects.toThrow(/Failed to load/)
    })
  })
})
