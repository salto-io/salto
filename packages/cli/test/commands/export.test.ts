import { Workspace, exportToCsv, loadConfig } from 'salto'
import Prompts from '../../src/prompts'
import { MockWriteStream, getWorkspaceErrors } from '../mocks'
import { command } from '../../src/commands/export'

jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  exportToCsv: jest.fn().mockImplementation(() => Promise.resolve(4)),
  Workspace: {
    load: jest.fn().mockImplementation(
      config => ({ config, elements: [], hasErrors: () => false }),
    ),
  },
  loadConfig: jest.fn().mockImplementation(
    workspaceDir => ({ baseDir: workspaceDir, additionalBlueprints: [], cacheLocation: '' })
  ),
}))

describe('export command', () => {
  let cliOutput: { stdout: MockWriteStream; stderr: MockWriteStream }
  const workspaceDir = 'dummy_dir'
  const outputPath = 'dummy_outpath'

  beforeEach(() => {
    cliOutput = { stdout: new MockWriteStream(), stderr: new MockWriteStream() }
  })

  it('should run export', async () => {
    await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(exportToCsv).toHaveBeenCalled()
    expect(cliOutput.stdout.content).toMatch(Prompts.EXPORT_FINISHED_SUMMARY(4, 'Test', outputPath))
    expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
  })

  it('should fail on workspace errors', async () => {
    const erroredWorkspace = {
      hasErrors: () => true,
      errors: { strings: () => ['some error'] },
      getWorkspaceErrors,
    } as unknown as Workspace
    (Workspace.load as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredWorkspace))
    await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(cliOutput.stderr.content).toContain('Error')
  })

  it('should fail if export operation failed', async () => {
    (exportToCsv as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Test error')
    })
    await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
    expect(cliOutput.stderr.content).toContain(Prompts.OPERATION_FAILED_WITH_ERROR(new Error('Test error')))
  })
})
