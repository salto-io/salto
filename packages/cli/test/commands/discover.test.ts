import {
  discover as mockDiscover,
  Workspace as mockWorksapce,
  Workspace,
} from 'salto'
import { InstanceElement, ObjectType, Metrics } from 'adapter-api'
import { command } from '../../src/commands/discover'
import Prompts from '../../src/prompts'
import { MockWriteStream, discover } from '../mocks'

jest.mock('salto', () => ({
  discover: jest.fn().mockImplementation(
    (_workspace: Workspace,
      _fillConfig: (configType: ObjectType) => Promise<InstanceElement>,
      metrics?: Metrics) =>
      (discover(_workspace, _fillConfig, metrics))
  ),
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
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }

  describe('with a valid workspace', () => {
    beforeEach(async () => {
      cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
      await command(workspaceDir, cliOutput).execute()
    })
    it('should run discover with workspace loaded from provided directory', () => {
      const discoverCalls = (mockDiscover as jest.Mock).mock.calls
      expect(discoverCalls).toHaveLength(1)
      expect(discoverCalls[0][0].config.baseDir).toEqual(workspaceDir)
    })

    it('should print statistics', async () => {
      expect(cliOutput.stdout.content.search(Prompts.STATISTICS)).toBeGreaterThan(0)
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
        command(workspaceDir, cliOutput).execute()
      ).rejects.toThrow(/Failed to load/)
    })
  })
})
