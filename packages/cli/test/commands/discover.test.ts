import { discover as mockDiscover } from 'salto'
import { command } from '../../src/commands/discover'

jest.mock('salto', () => ({
  discover: jest.fn().mockImplementation((_workspace, _fillConfig) => Promise.resolve()),
  Workspace: {
    load: jest.fn().mockImplementation(
      workspaceDir => ({ baseDir: workspaceDir, errors: [] }),
    ),
  },
}))

describe('discover command', () => {
  it('should run discover with workspace loaded from provided directory and files', async () => {
    const workspaceDir = 'dummy_dir'
    const additaionFiles = ['dummy_filename.bp']
    await command(workspaceDir, additaionFiles).execute()

    const discoverCalls = (mockDiscover as jest.Mock).mock.calls
    expect(discoverCalls).toHaveLength(1)
    expect(discoverCalls[0][0].baseDir).toEqual(workspaceDir)
  })
})
