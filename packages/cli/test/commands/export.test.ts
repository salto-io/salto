import { Workspace, exportToCsv, loadConfig } from 'salto'
import { DataModificationResult } from 'adapter-api'
import Prompts from '../../src/prompts'
import { MockWriteStream, getWorkspaceErrors, mockLoadConfig } from '../mocks'
import { command } from '../../src/commands/export'
import { CliExitCode } from '../../src/types'

jest.mock('salto', () => ({
  ...require.requireActual('salto'),
  exportToCsv: jest.fn().mockImplementation(() => Promise.resolve({
    successfulRows: 5,
    failedRows: 0,
    errors: new Set<string>(),
  })),
  Workspace: {
    load: jest.fn().mockImplementation(
      config => ({ config, elements: [], hasErrors: () => false }),
    ),
  },
  loadConfig: jest.fn().mockImplementation((workspaceDir: string) => mockLoadConfig(workspaceDir)),
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
    expect(cliOutput.stdout.content).toMatch(Prompts.EXPORT_ENDED_SUMMARY(5, 'Test', outputPath))
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
    const errors = ['error1', 'error2']
    const erroredModifyDataResult = {
      successfulRows: 1,
      failedRows: 0,
      errors: new Set<string>(errors),
    } as unknown as DataModificationResult
    (exportToCsv as jest.Mock).mockResolvedValueOnce(Promise.resolve(erroredModifyDataResult))
    const exitCode = await command(workspaceDir, 'Test', outputPath, cliOutput).execute()
    expect(cliOutput.stdout.content).toMatch(Prompts.EXPORT_ENDED_SUMMARY(1, 'Test', outputPath))
    expect(cliOutput.stdout.content).toMatch(Prompts.ERROR_SUMMARY(errors))
    expect(Workspace.load).toHaveBeenCalledWith(loadConfig(workspaceDir))
    expect(exitCode).toEqual(CliExitCode.AppError)
  })
})
