import {
  discover as mockDiscover,
  Workspace as mockWorksapce,
} from 'salto'
import { command } from '../../src/commands/discover'
import { MockWriteStream } from '../mocks'


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
  describe('with a valid workspace', () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    beforeEach(async () => {
      await command(workspaceDir, cliOutput).execute()
    })
    it('should run discover with workspace loaded from provided directory', () => {
      const discoverCalls = (mockDiscover as jest.Mock).mock.calls
      expect(discoverCalls).toHaveLength(1)
      expect(discoverCalls[0][0].config.baseDir).toEqual(workspaceDir)
    })
  })
  describe('with errored workspace', () => {
    const cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
    beforeEach(() => {
      mockWorksapce.load = jest.fn().mockImplementationOnce(
        baseDir => ({
          hasErrors: () => true,
          baseDir,
          errors: {
            strings: () => ['some Error'],
          },
        })
      )
    })
    it('should fail', async () => {
      await command(workspaceDir, cliOutput).execute()
      expect(cliOutput.stderr.content.search('Error')).toBeGreaterThan(0)
    })
  })
})
